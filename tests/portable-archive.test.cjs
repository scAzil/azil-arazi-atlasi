'use strict';
/* Regression tests for the real ZIP writer/reader; no user files. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(process.argv[2]||'desktop-source/app');
const {exportPortable,importPortable}=require(path.join(root,'electron/portable-archive.cjs'));
const {unzipSync}=require(path.join(root,'app/vendor/fflate.js'));
const hash=d=>crypto.createHash('sha256').update(d).digest('hex');

const run=async()=>{
 const tmp=await fsp.mkdtemp(path.join(os.tmpdir(),'azil-atlas-test-'));
 try{
  const raw=Buffer.from('tiny mock jpeg binary for archive test');
  const ref=hash(raw)+'.jpg';
  const imageDir=path.join(tmp,'media');
  await fsp.mkdir(imageDir);
  await fsp.writeFile(path.join(imageDir,ref),raw);
  const record={
   id:'point-original-1',title:'Türkçe ğüşiöç nokta',project:'Aktif Proje',
   date:'2026-11-13T00:00:00.000Z',type:'Akarsu',note:'Güncel gözlem',
   lat:36.3,lon:36.35,parentId:null,photos:[{name:'Fotoğraf.jpg',ref}]
  };
  const visit={...record,id:'visit-1',title:'İkinci ziyaret',parentId:record.id,photos:[]};
  const layer={id:'layer-polygon-1',kind:'vector',name:'KML alanı',
   visible:true,data:{type:'FeatureCollection',features:[]},
   style:{polygon:{color:'#aabbcc',fillColor:'#abcdef',weight:4,fillOpacity:0}}};
  const state={version:1,projects:['Aktif Proje'],records:[record,visit],
    layers:[layer],trash:[{value:{title:'Silinen eski proje'}}],
    history:[{value:{note:'Silinen geçmiş'}}],receipts:{secret:'token'},
    settings:{theme:'dark',basemap:'osm',esriKey:'DONT_EXPORT_THIS',photoMax:'1280'}};
  const store={state,
   assetFile:id=>path.join(imageDir,id),
   run:async fn=>fn(),
   commit:async next=>{store.state=next;return true}};
  const archive=path.join(tmp,'AZiL-Atlas-test.atlas.zip');
  const summary=await exportPortable(store,archive,'1.1.0-beta.2');
  assert.equal(summary.records,2);
  const zipped=unzipSync(new Uint8Array(await fsp.readFile(archive)));
  const names=Object.keys(zipped).sort();
  assert.deepEqual(names,['assets/'+ref,'data/state.json','manifest.json'].sort());
  const m=JSON.parse(Buffer.from(zipped['manifest.json']).toString('utf8'));
  assert.equal(m.format,'azil-atlas');
  assert.equal(m.schemaVersion,1);
  assert.equal(m.assets.length,1);
  assert.equal(m.checksums['data/state.json'],hash(zipped['data/state.json']));
  const data=JSON.parse(Buffer.from(zipped['data/state.json']).toString('utf8'));
  assert.equal(data.records[0].title,record.title);
  assert.equal(data.layers[0].style.polygon.fillOpacity,0);
  assert.equal(data.records[1].parentId,record.id);
  assert.equal(data.trash,undefined);
  assert.equal(data.history,undefined);
  assert.equal(data.receipts,undefined);
  assert.equal(data.settings.esriKey,undefined);
  const emptyDir=path.join(tmp,'import-assets');
  await fsp.mkdir(emptyDir);
  const destination={
   state:{version:1,projects:[],records:[],layers:[],settings:{theme:'light'},trash:[],history:[]},
   assetFile:id=>path.join(emptyDir,id),
   run:async fn=>fn(),
   commit:async next=>{destination.state=next;return true}
  };
  const imported=await importPortable(destination,archive);
  assert.equal(imported.newRecords,2);
  assert.equal(imported.newLayers,1);
  assert.equal(destination.state.records[1].parentId,record.id);
  assert.equal(destination.state.settings.theme,'light');
  assert.deepEqual(await fsp.readFile(path.join(emptyDir,ref)),raw);
  const again=await importPortable(destination,archive);
  assert.equal(again.newRecords,0);
  assert.equal(again.newLayers,0);
  destination.state.records[0].note='Different local data, must never overwrite!';
  await assert.rejects(importPortable(destination,archive),/çakışıyor/);
  assert.equal(destination.state.records[0].note,'Different local data, must never overwrite!');
  // Interoperability: same ZIP must cross desktop/web boundaries exactly.
  const webDir=path.join(tmp,'browser-modules');
  await fsp.mkdir(webDir);
  await fsp.writeFile(path.join(webDir,'package.json'),'{"type":"module"}');
  for(const name of ['atlas-standard.js','atlas-archive-adapter.js'])
    await fsp.copyFile(path.join(process.cwd(),'web-integration',name),path.join(webDir,name));
  const standard=await import(pathToFileURL(path.join(webDir,'atlas-standard.js')).href);
  const browser=await import(pathToFileURL(path.join(webDir,'atlas-archive-adapter.js')).href);
  assert.equal(standard.normalizeLayerStyle(layer.style).polygon.fillOpacity,0);
  assert.equal(standard.geometryStyle({type:'Polygon'},layer).fillOpacity,0);
  assert.equal(standard.geometryStyle({type:'LineString'},{
    style:{line:{color:'#abcdef',weight:7,opacity:.6}}}).weight,7);
  assert.equal(standard.geometryStyle({type:'Point'},{
    style:{point:{radius:12,fillColor:'#123abc'}}}).radius,12);
  const fflate=require(path.join(root,'app/vendor/fflate.js'));
  const desktopInBrowser=await browser.readArchive(
    new Blob([await fsp.readFile(archive)],{type:'application/zip'}),{fflate});
  assert.equal(desktopInBrowser.state.records[0].title,record.title);
  assert.equal(desktopInBrowser.assets.size,1);
  const webZip=await browser.exportArchive({
    state,
    appVersion:'web-test',
    getAsset:async requested=>requested===ref?new Blob([raw],{type:'image/jpeg'}):null,
    fflate
  });
  const webPath=path.join(tmp,'from-web.atlas.zip');
  await fsp.writeFile(webPath,Buffer.from(await webZip.arrayBuffer()));
  const webDestDir=path.join(tmp,'from-web-assets');
  await fsp.mkdir(webDestDir);
  const webDest={
    state:{version:1,projects:[],records:[],layers:[],settings:{theme:'light'},trash:[],history:[]},
    assetFile:id=>path.join(webDestDir,id),
    run:async fn=>fn(),
    commit:async next=>{webDest.state=next}
  };
  const webImported=await importPortable(webDest,webPath);
  assert.equal(webImported.newRecords,2);
  assert.equal(webImported.newLayers,1);
  assert.equal(webDest.state.layers[0].style.polygon.fillOpacity,0);
  assert.deepEqual(await fsp.readFile(path.join(webDestDir,ref)),raw);
  console.log('PASS: desktop ZIP -> web, web ZIP -> desktop, style interoperability');
  console.log('PASS: portable ZIP export, SHA-256, Turkish names, parent visits, styles, no history/secrets, safe merge');
 }finally{await fsp.rm(tmp,{recursive:true,force:true})}
};
run().catch(e=>{console.error(e);process.exitCode=1});
