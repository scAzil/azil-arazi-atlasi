'use strict';
const assert=require('node:assert/strict');
const {createLanReceiver,sealed,opened,isPrivateIPv4,listAddresses}=
  require('../desktop-source/app/electron/lan-receiver.cjs');

async function main(){
  assert.equal(isPrivateIPv4('192.168.1.9'),true);
  assert.equal(isPrivateIPv4('10.12.1.3'),true);
  assert.equal(isPrivateIPv4('172.17.2.1'),true);
  assert.equal(isPrivateIPv4('8.8.8.8'),false);
  assert.equal(isPrivateIPv4('127.0.0.1'),false);
  assert.equal(isPrivateIPv4('192.168.666.1'),false);
  const adapters={
    'VPN Forti':[{family:'IPv4',internal:false,address:'10.1.2.3'}],
    'Wi-Fi':[{family:'IPv4',internal:false,address:'192.168.1.9'}]
  };
  assert.equal(listAddresses(adapters)[0].address,'192.168.1.9');
  const records=[];
  let started=0,finished=0;
  const receiver=createLanReceiver({
    bindHost:'127.0.0.1',networkInterfaces:adapters,
    onStart:async count=>{started=count},
    onRecord:async record=>{records.push(record);return{status:'added'}},
    onDone:async data=>{finished=data.received}
  });
  const session=await receiver.ready;
  const invite=new URL(session.url);
  assert.equal(invite.protocol,'azil-atlas:');
  assert.equal(invite.hostname,'lan');
  assert.equal(invite.searchParams.get('ip'),'192.168.1.9');
  assert.equal(invite.searchParams.get('port'),String(session.port));
  const token=invite.searchParams.get('token');
  assert.match(token,/^[0-9a-f]{64}$/);
  const key=Buffer.from(token,'hex');
  const endpoint='http://127.0.0.1:'+session.port+'/v1/transfer';
  let seq=0;
  async function post(data,{badKey=false,raw=false}={}){
    const body=JSON.stringify(sealed(badKey?Buffer.alloc(32,7):key,data));
    assert.ok(!body.includes('Örnek nokta'),'Plain record must not appear on wire.');
    assert.ok(!body.includes(token),'Secret key must not be sent in request.');
    const res=await fetch(endpoint,{
      method:'POST',headers:{'Content-Type':'application/json'},body
    });
    const reply=await res.json();
    if(raw)return {status:res.status,body:reply};
    assert.equal(res.status,200,JSON.stringify(reply));
    return opened(key,reply);
  }
  try{
    const malicious=await post({seq:1,kind:'begin',count:1},{badKey:true,raw:true});
    assert.equal(malicious.status,422);
    assert.equal(started,0);
    assert.equal((await post({seq:++seq,kind:'hello'})).kind,'hello');
    const ready=await post({seq:++seq,kind:'begin',count:2});
    assert.equal(ready.kind,'ready');
    const point={id:'p1',title:'Örnek nokta',project:'Test',parentId:null,photos:[]};
    const visit={id:'v1',title:'Ziyaret',project:'Test',parentId:'p1',photos:[]};
    const receipt1=await post({seq:++seq,kind:'record',record:point});
    assert.equal(receipt1.kind,'receipt');
    assert.equal(receipt1.key,'p1');
    const receipt2=await post({seq:++seq,kind:'record',record:visit});
    assert.equal(receipt2.received,2);
    assert.equal((await post({seq:++seq,kind:'done'})).received,2);
    assert.equal(started,2);
    assert.equal(finished,2);
    assert.deepEqual(records.map(r=>r.id),['p1','v1']);
    const replay=await post({seq:3,kind:'record',record:point},{raw:true});
    assert.equal(replay.status,422);
    assert.equal(records.length,2);
    console.log('PASS: LAN QR IPv4 selection, AES-GCM private handshake, ordered records, receipts and replay rejection');
  }finally{receiver.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
