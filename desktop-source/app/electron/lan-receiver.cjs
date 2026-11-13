'use strict';
/**
 * AZiL LAN transfer v1. Short-lived direct local-network receiver.
 * AES-256-GCM encrypts every request and response using the 256-bit QR secret.
 * No cloud, relay, TLS dependency or user-account service.
 */
const http=require('node:http');
const os=require('node:os');
const crypto=require('node:crypto');

const MAX_BODY=90*1024*1024;
const MAX_RECORDS=10000;
const IDLE_MS=12*60*1000;

const isPrivateIPv4=address=>{
  if(typeof address!=='string')return false;
  const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if(!m)return false;
  const n=m.slice(1).map(Number);
  if(n.some(x=>x>255))return false;
  return n[0]===10||(n[0]===172&&n[1]>=16&&n[1]<=31)||
    (n[0]===192&&n[1]===168);
};
function listAddresses(source=os.networkInterfaces()){
  const candidates=[];
  for(const [name,entries] of Object.entries(source)){
    for(const item of entries||[]){
      if(item.internal||!(item.family==='IPv4'||item.family===4)||
         !isPrivateIPv4(item.address))continue;
      const lowered=name.toLowerCase();
      const virtual=/vpn|virtual|docker|veth|wsl|vmware|virtualbox|hyper-v|loopback|forti|tun|tap|tailscale|warp/.test(lowered);
      const priority=(virtual?100:0)+
        (/wi-?fi|wlan|kablosuz|wireless/.test(lowered)?0:
         /ethernet|lan|yerel/.test(lowered)?1:4)+
        (item.address.startsWith('192.168.')?0:10);
      candidates.push({address:item.address,interface:name,priority});
    }
  }
  candidates.sort((a,b)=>a.priority-b.priority);
  return candidates;
}
function sealed(key,body){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const raw=Buffer.from(JSON.stringify(body),'utf8');
  const encrypted=Buffer.concat([cipher.update(raw),cipher.final()]);
  return {
    iv:iv.toString('base64'),
    data:encrypted.toString('base64'),
    tag:cipher.getAuthTag().toString('base64')
  };
}
function decodeBase64(value,max){
  if(typeof value!=='string'||value.length>max||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw Error('Şifreli ileti biçimi geçersiz.');
  const buffer=Buffer.from(value,'base64');
  if(buffer.toString('base64')!==value)return (()=>{throw Error('Base64 doğrulaması başarısız.')})();
  return buffer;
}
function opened(key,envelope){
  if(!envelope||typeof envelope!=='object')throw Error('Şifreli aktarım bulunamadı.');
  const iv=decodeBase64(envelope.iv,128),tag=decodeBase64(envelope.tag,128);
  const data=decodeBase64(envelope.data,MAX_BODY*1.35+512);
  if(iv.length!==12||tag.length!==16)throw Error('AES-GCM IV/tag geçersiz.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAuthTag(tag);
  const plaintext=Buffer.concat([decipher.update(data),decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
function reply(res,status,body){
  const json=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Content-Length':json.length,
    'Connection':'close'
  });
  res.end(json);
}
function createLanReceiver({onStart=async()=>{},onRecord=async()=>({status:'added'}),
  onDone=async()=>{},onStatus=()=>{},bindHost='0.0.0.0',networkInterfaces}={}){
  const choices=listAddresses(networkInterfaces||os.networkInterfaces());
  if(!choices.length)throw Error('Bilgisayarın özel ağ IPv4 adresi bulunamadı. Wi-Fi/Ethernet bağlantısını kontrol edin.');
  const token=crypto.randomBytes(32).toString('hex');
  const key=Buffer.from(token,'hex');
  let server=null,sequence=0,expected=0,received=0,active=false,closed=false,processing=false;
  let idleTimer=null,attached=false;
  const sendStatus=text=>{try{onStatus(String(text))}catch{}};
  const close=()=>{
    closed=true;
    if(idleTimer)clearTimeout(idleTimer);
    if(server)server.close();
    sendStatus('Yerel QR oturumu kapandı. Kayıtlar korunuyor.');
  };
  const refresh=()=>{
    if(idleTimer)clearTimeout(idleTimer);
    idleTimer=setTimeout(close,IDLE_MS);
    idleTimer.unref?.();
  };
  async function handler(req,res){
    if(closed||req.method!=='POST'||req.url!=='/v1/transfer'){
      return reply(res,404,{error:'Kapalı/yanlış uç nokta.'});
    }
    if(processing)return reply(res,409,{error:'Başka aktarım işlemi sürüyor.'});
    processing=true;refresh();
    try{
      const data=[];
      let total=0;
      for await(const chunk of req){
        total+=chunk.length;
        if(total>MAX_BODY)throw Error('Aktarım 90 MB sınırını aşıyor.');
        data.push(chunk);
      }
      const envelope=JSON.parse(Buffer.concat(data).toString('utf8'));
      const message=opened(key,envelope);
      if(!Number.isSafeInteger(message.seq)||message.seq!==sequence+1)
        throw Error('Aktarım sıra numarası uyuşmadı; yeni QR oturumu açın.');
      let result;
      if(message.kind==='begin'){
        if(active)throw Error('Aktarım başlatılmış.');
        if(!Number.isInteger(message.count)||message.count<1||message.count>MAX_RECORDS)
          throw Error('Aktarılacak kayıt sayısı geçersiz.');
        await onStart(message.count);
        active=true;expected=message.count;received=0;
        result={kind:'ready',count:expected};
        sendStatus('Telefon bağlandı, '+expected+' kayıt alınacak.');
      }else if(message.kind==='record'){
        if(!active||received>=expected||!message.record||typeof message.record!=='object')
          throw Error('Aktarım kaydı beklenmiyor.');
        if(message.record.id==null||message.record.id.length>200)throw Error('Kayıt kimliği geçersiz.');
        const status=await onRecord(message.record);
        received++;
        result={kind:'receipt',key:message.record.id,status:status.status,
          received,expected};
        sendStatus('Yerel QR aktarımı '+received+'/'+expected+' · '+status.status);
      }else if(message.kind==='done'){
        if(!active||received!==expected)throw Error('Kayıt sayısı eksik; aktarım tamamlanmadı.');
        await onDone({expected,received});
        active=false;result={kind:'done',received,expected};
        sendStatus('Yerel QR aktarımı tamamlandı: '+received+' kayıt.');
      }else throw Error('Bilinmeyen aktarım adımı.');
      sequence=message.seq;
      return reply(res,200,sealed(key,result));
    }catch(error){
      const publicText=String(error?.message||'Aktarım hatası').slice(0,200);
      sendStatus('Yerel QR hatası: '+publicText);
      return reply(res,422,{error:publicText});
    }finally{processing=false;}
  }
  server=http.createServer(handler);
  server.requestTimeout=120000;
  server.headersTimeout=20000;
  server.keepAliveTimeout=1000;
  const ready=new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,bindHost,()=>{
      server.off('error',reject);
      attached=true;
      refresh();
      const port=server.address().port;
      const invitations=choices.map(item=>({
        address:item.address,interface:item.interface,
        url:'azil-atlas://lan?ip='+item.address+'&port='+port+'&token='+token
      }));
      sendStatus('Yerel QR hazır: '+choices[0].address+':'+port);
      resolve({url:invitations[0].url,invitations,port,close});
    });
  });
  return {ready,close};
}
module.exports={createLanReceiver,listAddresses,isPrivateIPv4,sealed,opened};
