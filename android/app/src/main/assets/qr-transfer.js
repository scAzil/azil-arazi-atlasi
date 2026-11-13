/* AZiL Android -> Windows v1.1 QR sender (desktop transfer protocol 1).
 * QR is parsed locally, not opened as a website. Records travel via WebRTC.
 */
import {joinRoom} from './vendor/trystero.js';

const ROOM_APP='arazi-atlasi-desktop-transfer-v1';
const RELAY_URLS=['wss://nos.lol','wss://relay.damus.io'];
const DESKTOP_HOST='arazi-atlasi.chic-cabin-0509.chatgpt.site';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes=data=>new TextEncoder().encode(JSON.stringify(data));
const sha256=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),
  x=>x.toString(16).padStart(2,'0')).join('');
const wait=(promise,ms,message)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(message)),ms);
  Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});
});

export function readDesktopInvite(value){
  const uri=new URL(String(value||'').trim());
  if(uri.protocol!=='https:'||uri.hostname!==DESKTOP_HOST||uri.port||uri.username||uri.password)
    throw Error('QR, AZiL Arazi Atlası Windows uygulamasına ait değil.');
  if(!uri.hash.startsWith('#sync='))throw Error('QR aktarım anahtarı bulunamadı.');
  const raw=uri.hash.slice(6);
  if(raw.length>3000||!/^[\w-]+$/.test(raw))throw Error('QR biçimi geçersiz.');
  const normal=raw.replace(/-/g,'+').replace(/_/g,'/');
  const invite=JSON.parse(atob(normal.padEnd(Math.ceil(normal.length/4)*4,'=')));
  if(invite.app!=='DSD'||invite.version!=='1.1'||invite.scope!=='all'||
     invite.desktopTransfer!==1||!/^[a-f0-9]{64}$/.test(invite.sessionId||''))
    throw Error('Windows QR protokolü tanınmıyor.');
  return {token:invite.sessionId};
}

export function collectRecords(state,selection){
  if(!Array.isArray(state?.records))throw Error('Kayıt listesi geçersiz.');
  const byId=new Map(state.records.map(r=>[r.id,r]));
  const ids=new Set();
  for(const id of selection){
    const r=byId.get(id);
    if(!r)continue;
    ids.add(id);
    if(r.parentId){
      const parent=byId.get(r.parentId);
      if(!parent||parent.parentId)throw Error('Ziyaret için ana nokta bulunamadı: '+r.title);
      ids.add(parent.id);
    }
  }
  if(ids.size===0||ids.size>10000)throw Error('1–10.000 arası kayıt seçilmeli.');
  const records=[...ids].map(id=>byId.get(id));
  records.sort((a,b)=>{
    if(a.id===b.parentId)return -1;
    if(b.id===a.parentId)return 1;
    if(Boolean(a.parentId)!==Boolean(b.parentId))return a.parentId?1:-1;
    return String(a.date||'').localeCompare(String(b.date||''));
  });
  return records;
}
function base64Of(data){
  // Three-byte-aligned chunks avoid accidental interior base64 padding.
  let encoded='',stride=32766;
  for(let i=0;i<data.length;i+=stride)
    encoded+=btoa(String.fromCharCode(...data.subarray(i,i+stride)));
  return encoded;
}
export async function encodeRecord(record,{fetchFn=fetch}={}){
  const prepared={...record,photos:[]};
  for(const photo of record.photos||[]){
    if(!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(photo.ref||''))
      throw Error('Fotoğraf dosya adı geçersiz.');
    const response=await fetchFn('/local/'+photo.ref,{cache:'no-store'});
    if(!response.ok)throw Error('Fotoğraf okunamadı: '+photo.ref);
    const photoBytes=new Uint8Array(await response.arrayBuffer());
    if(photoBytes.byteLength>15*1024*1024)throw Error('Fotoğraf çok büyük.');
    const ext=photo.ref.split('.').pop();
    prepared.photos.push({
      name:String(photo.name||'Fotoğraf').slice(0,200),
      data:'data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+base64Of(photoBytes)
    });
  }
  const result=bytes({key:record.id,record:prepared});
  if(result.byteLength>75*1024*1024)throw Error('Kayıt çok büyük; ZIP arşivi kullanın.');
  return result;
}

export function createQrSender({joinRoomImpl=joinRoom,fetchFn=fetch,onStatus=()=>{},onProgress=()=>{}}={}){
  let room=null,ctl=null,data=null,peer=null,ready=false,closed=true,busy=false,awaitReady=null,awaitReceipt=null;
  const status=message=>onStatus(String(message));
  function endWaiters(message){
    const error=Error(message);
    awaitReady?.reject(error);awaitReady=null;
    awaitReceipt?.reject(error);awaitReceipt=null;
  }
  function disconnect(){
    closed=true;endWaiters('Bağlantı kapatıldı.');
    if(room)room.leave();
    room=null;ctl=null;data=null;peer=null;ready=false;busy=false;
    status('Bağlantı kapalı. Telefondaki kayıtlar korunuyor.');
  }
  function connect(token){
    disconnect();closed=false;
    room=joinRoomImpl({appId:ROOM_APP,password:token,relayConfig:{urls:RELAY_URLS}},token,{
      onJoinError:()=>status('Bağlantı kurulamadı. İnterneti ve Windows QR ekranını kontrol edin.')
    });
    ctl=room.makeAction('atlas-desk-ctl');
    data=room.makeAction('atlas-desk-data');
    room.onPeerJoin=id=>{
      if(peer&&peer!==id)return;
      peer=id;status('Bilgisayar bulundu. Bağlantı doğrulanıyor…');
    };
    room.onPeerLeave=id=>{
      if(peer!==id)return;
      peer=null;ready=false;endWaiters('Bilgisayar bağlantısı kesildi.');
      status('Bilgisayar ayrıldı. Telefon kayıtları korunuyor.');
    };
    ctl.onMessage=(message,ctx)=>{
      if(closed||!peer||ctx.peerId!==peer||!message)return;
      if(message.kind==='hello'&&message.protocol===1){
        ready=true;status('Bilgisayar hazır. Kayıtları seçip Gönder düğmesine basın.');
      }else if(message.kind==='ready'){
        awaitReady?.resolve(true);awaitReady=null;
      }else if(message.kind==='receipt'){
        if(awaitReceipt&&awaitReceipt.key===message.key&&awaitReceipt.hash===message.hash){
          awaitReceipt.resolve(message);awaitReceipt=null;
        }
      }else if(message.kind==='error'){
        endWaiters('Windows hata bildirdi: '+String(message.message).slice(0,200));
        status('Windows hata bildirdi: '+String(message.message).slice(0,200));
      }
    };
    status('Windows QR okundu. Bağlantı kuruluyor…');
  }
  async function transfer(records){
    if(busy)throw Error('Aktarım zaten sürüyor.');
    if(!room||!peer||!ready)throw Error('Bilgisayar bağlantısı henüz hazır değil.');
    if(!Array.isArray(records)||records.length<1)throw Error('Kayıt seçilmedi.');
    busy=true;let completed=0,warnings=0;
    try{
      const readyP=new Promise((resolve,reject)=>awaitReady={resolve,reject});
      await ctl.send({kind:'begin',count:records.length},{target:peer});
      await wait(readyP,25000,'Bilgisayar aktarımı başlatmadı.');
      for(const r of records){
        status('Hazırlanıyor: '+r.title);
        const raw=await encodeRecord(r,{fetchFn});
        const hash=await sha256(raw);
        const receiptP=new Promise((resolve,reject)=>awaitReceipt={key:r.id,hash,resolve,reject});
        await data.send(raw,{target:peer,metadata:{hash}});
        const result=await wait(receiptP,45000,'Windows kayıt makbuzu göndermedi: '+r.title);
        completed++;
        if(!['added','same','conflict'].includes(result.status))warnings++;
        onProgress({done:completed,total:records.length,receipt:result});
      }
      await ctl.send({kind:'done'},{target:peer});
      status('Aktarım bitti: '+completed+'/'+records.length+' kayıt. Windows sonuçlarını kontrol edin.');
      return {completed,warnings};
    }catch(e){status('Aktarım durdu: '+e.message);throw e;}
    finally{busy=false;awaitReady=null;awaitReceipt=null;}
  }
  return {connect,transfer,disconnect,get ready(){return !closed&&!!peer&&ready}};
}

const statusEl=document.getElementById('qrStatus');
const selectionEl=document.getElementById('qrRecords');
const sendBtn=document.getElementById('sendQrBtn');
const progressEl=document.getElementById('qrProgress');
const resultEl=document.getElementById('qrReceipt');
let sender;
sender=createQrSender({
  onStatus:message=>{statusEl.textContent=message;if(sender)sendBtn.disabled=!sender.ready;},
  onProgress:info=>{
    progressEl.max=info.total;progressEl.value=info.done;
    resultEl.textContent=info.done+' / '+info.total+' kayıt bilgisayar tarafından alındı.';
  }
});
function renderSelection(){
  const state=window.AtlasField?.getState?.();
  if(!state)return;
  const checked=new Set([...selectionEl.querySelectorAll('input:checked')].map(x=>x.value));
  const old=new Set([...selectionEl.querySelectorAll('input[data-qr-record]')].map(x=>x.value));
  selectionEl.innerHTML=state.records.length?state.records.map(r=>
    '<label class="qrChoice"><input data-qr-record type="checkbox" value="'+esc(r.id)+'" '+
    (!old.size||checked.has(r.id)?'checked':'')+'><span><b>'+esc(r.title)+
    '</b><small>'+esc(r.project)+(r.parentId?' · Ziyaret':' · Ana nokta')+
    ' · '+(r.photos||[]).length+' fotoğraf</small></span></label>'
  ).join(''):'<p>Aktarılacak kayıt yok. Önce bir nokta oluşturun.</p>';
}
document.getElementById('scanQRBtn').onclick=()=>{
  if(window.AndroidAtlas?.scanDesktopQr)window.AndroidAtlas.scanDesktopQr();
  else statusEl.textContent='QR tarayıcı kullanılamıyor.';
};
document.getElementById('disconnectQrBtn').onclick=()=>sender.disconnect();
document.getElementById('refreshQrBtn').onclick=renderSelection;
document.getElementById('qrSelectAll').onchange=e=>{
  selectionEl.querySelectorAll('input[data-qr-record]').forEach(x=>x.checked=e.target.checked);
};
sendBtn.onclick=async()=>{
  sendBtn.disabled=true;resultEl.textContent='';
  try{
    const picked=[...selectionEl.querySelectorAll('input:checked')].map(x=>x.value);
    const list=collectRecords(window.AtlasField.getState(),picked);
    await sender.transfer(list);
  }catch(e){resultEl.textContent='Hata: '+e.message;}
  finally{sendBtn.disabled=!sender.ready;}
};
window.AZILQr={
  onScanResult(value){
    try{
      sender.connect(readDesktopInvite(value).token);
      progressEl.value=0;resultEl.textContent='';
    }catch(e){statusEl.textContent='QR hatası: '+e.message;}
  },
  renderSelection,
  disconnect:()=>sender.disconnect()
};
renderSelection();
