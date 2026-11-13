'use strict';
const {chromium}=require('playwright-core');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve('android/app/src/main/assets');
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
 try{
  const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);
  res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');
  res.end(data);
 }catch(e){res.writeHead(404);res.end('not found')}
});
(async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-gpu']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(()=>{
   let data={version:1,projects:[],records:[],layers:[],settings:{theme:'light'}};
   const good=o=>JSON.stringify(Object.assign({ok:true},o||{}));
   window.AndroidAtlas={
    getState:()=>JSON.stringify(data),
    addProject:name=>{data.projects.push(name);return good();},
    addRecord:text=>{
     const r=JSON.parse(text);r.id='mock-point-1';r.date=new Date().toISOString();r.photos=[];
     data.records.push(r);return good({id:r.id});
    },
    addLayer:text=>{
     const l=JSON.parse(text);l.id='mock-layer-1';data.layers.push(l);return good({id:l.id});
    },
    toggleLayer:id=>{
     const l=data.layers.find(x=>x.id===id);l.visible=!l.visible;return good();
    },
    updateLayerStyle:(id,content)=>{
     const l=data.layers.find(x=>x.id===id);l.style=JSON.parse(content);return good();
    },
    addPhoto:()=>good(),
    requestLocation:()=>{},
    requestExport:()=>{},
    requestImport:()=>{}
   };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load'});
  await page.waitForTimeout(350);
  assert.ok(await page.locator('.leaflet-container').count(),'Leaflet did not mount');
  assert.ok((await page.locator('#offlineBadge').innerText()).includes('Yerel'));
  assert.equal((await page.locator('#basemapBtn').innerText()).includes('OSM aç'),true);
  await page.locator('[data-tab="projects"]').click();
  await page.locator('#newProject').fill('Örnek Proje');
  await page.locator('#createProject').click();
  assert.ok((await page.locator('#projectList').innerText()).includes('Örnek Proje'));
  await page.locator('[data-tab="records"]').click();
  await page.locator('#addRecordBtn').click();
  await page.locator('#recTitle').fill('Saha gözlemi');
  await page.locator('#recLat').fill('36.3');
  await page.locator('#recLon').fill('36.35');
  await page.locator('#recordForm button[type="submit"]').click();
  assert.ok((await page.locator('#recordList').innerText()).includes('Saha gözlemi'));
  await page.locator('[data-tab="map"]').click();
  await page.locator('#layerToggleBtn').click();
  await page.locator('#layerFile').setInputFiles({
   name:'ornek.kml',mimeType:'application/vnd.google-earth.kml+xml',
   buffer:Buffer.from('<?xml version="1.0" encoding="UTF-8"?><kml><Document><Placemark><name>Örnek alan</name><Polygon><outerBoundaryIs><LinearRing><coordinates>36.3,36.3 36.35,36.3 36.35,36.35 36.3,36.3</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>')
  });
  await page.locator('[data-laction="style"]').waitFor({timeout:10000});
  await page.locator('[data-laction="style"]').click();
  await page.locator('#styleOpacity').fill('0');
  await page.locator('#styleForm button.primary').click();
  const style=await page.evaluate(()=>JSON.parse(window.AndroidAtlas.getState()).layers[0].style);
  assert.equal(style.polygon.fillOpacity,0);
  await page.locator('[data-tab="archive"]').click();
  assert.ok((await page.locator('#view-archive').innerText()).includes('AZIL-ATLAS/1'));
  // Exercise the exact Windows QR invitation and a complete fake desktop
  // begin -> ready -> binary SHA-256 -> receipt -> done handshake.
  const qr=await page.evaluate(async()=>{
    const api=await import('/qr-transfer.js');
    const token='a'.repeat(64);
    const invitation={app:'DSD',version:'1.1',scope:'all',sessionId:token,desktopTransfer:1};
    const encoded=btoa(JSON.stringify(invitation)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const parsed=api.readDesktopInvite('https://arazi-atlasi.chic-cabin-0509.chatgpt.site/#sync='+encoded);
    let rejected=false;
    try{api.readDesktopInvite('https://evil.invalid/#sync='+encoded)}catch{rejected=true}
    const root={id:'parent1',title:'Ana nokta',project:'Örnek Proje',date:'2026-11-13T00:00:00Z',
      parentId:null,photos:[{ref:'b'.repeat(64)+'.jpg',name:'Fotoğraf'}]};
    const visit={id:'visit1',title:'Ziyaret',project:'Örnek Proje',
      date:'2026-11-13T01:00:00Z',parentId:'parent1',photos:[]};
    const batch=api.collectRecords({records:[visit,root]},['visit1']);
    const sent=[],receipts=[],control=[],status=[];
    let room,ctl,data;
    const fakeJoin=(config,roomId)=>{
      ctl={send:async function(message){
        control.push(message.kind);
        if(message.kind==='begin')queueMicrotask(()=>ctl.onMessage({kind:'ready'},{peerId:'desktop'}));
      },onMessage:null};
      data={send:async(raw,opts)=>{
        const str=new TextDecoder().decode(raw);
        sent.push({message:JSON.parse(str),hash:opts.metadata.hash});
        const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),
          x=>x.toString(16).padStart(2,'0')).join('');
        receipts.push(actual===opts.metadata.hash);
        queueMicrotask(()=>ctl.onMessage({kind:'receipt',key:JSON.parse(str).key,
          hash:opts.metadata.hash,status:'added'},{peerId:'desktop'}));
      }};
      room={onPeerJoin:null,onPeerLeave:null,leave(){},
        makeAction:id=>id==='atlas-desk-ctl'?ctl:data};
      queueMicrotask(()=>{room.onPeerJoin('desktop');
        ctl.onMessage({kind:'hello',protocol:1},{peerId:'desktop'})});
      return room;
    };
    const sender=api.createQrSender({joinRoomImpl:fakeJoin,
      onStatus:s=>status.push(s),
      fetchFn:async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([255,216,255,217]).buffer})});
    sender.connect(token);
    await new Promise(done=>setTimeout(done,20));
    const ready=sender.ready;
    const result=await sender.transfer(batch);
    sender.disconnect();
    return {parsed:parsed.token===token,rejected,order:batch.map(x=>x.id),ready,
      result,sent,receipts,control};
  });
  assert.equal(qr.parsed,true);
  assert.equal(qr.rejected,true);
  assert.deepEqual(qr.order,['parent1','visit1']);
  assert.equal(qr.ready,true);
  assert.deepEqual(qr.control,['begin','done']);
  assert.deepEqual(qr.receipts,[true,true]);
  assert.equal(qr.sent.length,2);
  assert.equal(qr.sent[0].message.record.photos.length,1);
  assert.ok(qr.sent[0].message.record.photos[0].data.startsWith('data:image/jpeg;base64,'));
  assert.ok(!('ref' in qr.sent[0].message.record.photos[0]));
  assert.equal(qr.result.completed,2);
  console.log('PASS: Windows QR invite validation, parent-first transfer, photos, SHA-256 and receipts');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: Android mobile renderer, offline Leaflet, projects, points, KML styling and archive UI');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
