'use strict';
/*
 * AZiL-ATLAS/1 portable snapshot for Electron.
 *
 * ZIP entries: manifest.json, data/state.json, assets/<SHA256>.<ext>.
 * Export is file-streamed; historical trash, receipts, previous versions
 * and private settings such as Esri API keys are deliberately excluded.
 * Import is explicit, prevalidated, and merges without replacing existing IDs.
 */
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {once}=require('node:events');
const {Zip,ZipPassThrough,unzipSync}=require('../app/vendor/fflate.js');

const FORMAT='azil-atlas', VERSION=1, CRS='EPSG:4326';
const ASSET_NAME=/^([a-f0-9]{64})\.(jpg|png|webp|json|kml|kmz)$/;
const ZIP_ASSET=/^assets\/([a-f0-9]{64})\.(jpg|png|webp|json|kml|kmz)$/;
const LIMIT_ARCHIVE=450*1024*1024; // Bound compressed import memory.
const LIMIT_UNPACKED=650*1024*1024;
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const isValidId=s=>typeof s==='string'&&s.length>0&&s.length<=200;

function snapshot(state) {
  const settings={};
  for(const key of ['theme','font','dense','basemap','photoMax'])
    if(state.settings&&state.settings[key]!==undefined)settings[key]=state.settings[key];
  return {
    version:1,
    projects:copy(state.projects||[]),
    records:copy(state.records||[]),
    layers:copy(state.layers||[]),
    settings
  };
}

function refsIn(current){
  const refs=new Set();
  for(const record of current.records)
    for(const photo of record.photos||[])if(photo.ref)refs.add(photo.ref);
  for(const layer of current.layers)if(layer.ref)refs.add(layer.ref);
  for(const ref of refs)if(!ASSET_NAME.test(ref))throw Error('Geçersiz arşiv varlığı: '+String(ref).slice(0,80));
  return [...refs].sort();
}

function checkState(state){
  if(!state||state.version!==1||!Array.isArray(state.projects)||
     !Array.isArray(state.records)||!Array.isArray(state.layers))
    throw Error('Arşiv kaydı geçersiz.');
  if(state.records.length>100000||state.layers.length>5000||state.projects.length>20000)
    throw Error('Arşiv çok fazla nesne içeriyor.');
  const ids=new Set(),parents=new Map();
  for(const r of state.records){
    if(!isValidId(r.id)||ids.has(r.id)||typeof r.title!=='string'||
       typeof r.project!=='string'||!Number.isFinite(Date.parse(r.date))||!Array.isArray(r.photos)||
       (r.lat!=null&&(!Number.isFinite(r.lat)||Math.abs(r.lat)>90))||
       (r.lon!=null&&(!Number.isFinite(r.lon)||Math.abs(r.lon)>180)))
      throw Error('Arşivde kayıt kimliği/koordinatı hatalı.');
    if((r.lat==null)!==(r.lon==null))throw Error('Arşivde eksik koordinat çifti.');
    ids.add(r.id);parents.set(r.id,r.parentId||null);
  }
  for(const r of state.records)if(r.parentId){
    if(!ids.has(r.parentId)||parents.get(r.parentId)||r.parentId===r.id)
      throw Error('Ana nokta–ziyaret bağlantısı geçersiz: '+r.id);
  }
  const layerIds=new Set();
  for(const l of state.layers){
    if(!isValidId(l.id)||layerIds.has(l.id))throw Error('Yinelenen katman kimliği.');
    layerIds.add(l.id);
  }
  refsIn(state);
}

function buildManifest(state,assets,appVersion){
  return {
    format:FORMAT,schemaVersion:VERSION,kind:'snapshot',
    createdAt:new Date().toISOString(),
    sourcePlatform:'desktop',appVersion:String(appVersion||'unknown'),
    crs:CRS,
    paths:{state:'data/state.json'},
    counts:{projects:state.projects.length,records:state.records.length,
            layers:state.layers.length,assets:assets.length},
    assets,checksums:{}
  };
}

async function hashFile(file){
  const hash=crypto.createHash('sha256');
  const stream=fs.createReadStream(file,{highWaterMark:1024*1024});
  for await(const block of stream)hash.update(block);
  return hash.digest('hex');
}

async function writeZip(dest,entries){
  const temp=dest+'.'+crypto.randomUUID()+'.tmp';
  await fsp.mkdir(path.dirname(dest),{recursive:true});
  let output;
  try{
    output=fs.createWriteStream(temp,{flags:'wx',highWaterMark:2*1024*1024});
    const finished=new Promise((resolve,reject)=>{
      output.once('finish',resolve);
      output.once('error',reject);
    });
    const zip=new Zip((error,chunk,final)=>{
      if(error){output.destroy(error);return;}
      if(!output.destroyed)output.write(Buffer.from(chunk));
      if(final&&!output.destroyed)output.end();
    });
    for(const entry of entries){
      const member=new ZipPassThrough(entry.name);
      zip.add(member);
      if(entry.buffer){
        member.push(new Uint8Array(entry.buffer),true);
      }else{
        for await(const chunk of fs.createReadStream(entry.file,{highWaterMark:1024*1024})){
          member.push(new Uint8Array(chunk),false);
          if(output.writableNeedDrain)await once(output,'drain');
        }
        member.push(new Uint8Array(),true);
      }
    }
    zip.end();
    await finished;
    await fsp.rename(temp,dest);
  }catch(error){
    if(output&&!output.destroyed)output.destroy();
    await fsp.rm(temp,{force:true}).catch(()=>{});
    throw error;
  }
}

async function exportPortable(store,output,appVersion){
  const current=snapshot(store.state);
  checkState(current);
  const names=refsIn(current);
  const assets=[];
  let total=0;
  for(const ref of names){
    const file=store.assetFile(ref);
    const stat=await fsp.stat(file);
    if(!stat.isFile())throw Error('Arşiv varlığı bulunamadı: '+ref);
    if(stat.size>250*1024*1024)throw Error('Tek varlık 250 MB sınırını aşıyor: '+ref);
    total+=stat.size;
    if(total>1100*1024*1024)throw Error('Taşınabilir arşiv 1,1 GB sınırını aşıyor.');
    const hash=await hashFile(file);
    if(hash!==ref.split('.')[0])throw Error('Fotoğraf/pafta SHA-256 doğrulaması başarısız: '+ref);
    const ext=path.extname(ref).slice(1);
    const type={jpg:'image/jpeg',png:'image/png',webp:'image/webp',
      kmz:'application/vnd.google-earth.kmz',kml:'application/vnd.google-earth.kml+xml',
      json:'application/json'}[ext];
    assets.push({path:'assets/'+ref,sha256:hash,size:stat.size,mediaType:type});
  }
  const json=Buffer.from(JSON.stringify(current),'utf8');
  if(json.length>80*1024*1024)throw Error('Arşiv JSON dosyası 80 MB sınırını aşıyor.');
  const manifest=buildManifest(current,assets,appVersion);
  manifest.checksums['data/state.json']=sha(json);
  const entries=[
    {name:'manifest.json',buffer:Buffer.from(JSON.stringify(manifest,null,2),'utf8')},
    {name:'data/state.json',buffer:json},
    ...assets.map(a=>({name:a.path,file:store.assetFile(path.basename(a.path))}))
  ];
  await writeZip(output,entries);
  return {file:output,bytes:(await fsp.stat(output)).size,
    projects:current.projects.length,records:current.records.length,
    layers:current.layers.length,assets:assets.length};
}

function validateManifest(m){
  if(!m||m.format!==FORMAT||m.schemaVersion!==VERSION||
     m.kind!=='snapshot'||m.crs!==CRS||m.paths?.state!=='data/state.json'||
     !['desktop','web'].includes(m.sourcePlatform)||!Array.isArray(m.assets)||
     !/^[a-f0-9]{64}$/.test(m.checksums?.['data/state.json']||''))
    throw Error('Arşiv biçimi/sürümü veya SHA-256 bilgisi geçersiz.');
  if(m.assets.length>20000)throw Error('Arşivde çok fazla varlık var.');
  const seen=new Set();
  for(const a of m.assets){
    const match=ZIP_ASSET.exec(a.path||'');
    if(!match||match[1]!==a.sha256||seen.has(a.path)||
       !Number.isSafeInteger(a.size)||a.size<0||a.size>250*1024*1024)
      throw Error('Arşiv varlık listesi güvenli değil.');
    seen.add(a.path);
  }
}

async function importPortable(store,filename){
  const stat=await fsp.stat(filename);
  if(stat.size>LIMIT_ARCHIVE)throw Error('Bu ZIP, bellekli içe aktarma sınırı olan 450 MB üzerindedir.');
  const zipped=await fsp.readFile(filename);
  let predicted=0;
  const unzipped=unzipSync(new Uint8Array(zipped),{filter:item=>{
    const name=item.name;
    if(name.includes('\\')||name.includes('..')||name.startsWith('/')||
       (name!=='manifest.json'&&name!=='data/state.json'&&!ZIP_ASSET.test(name)))
      throw Error('Arşivde güvenli olmayan dosya yolu var.');
    if(!Number.isSafeInteger(item.originalSize)||item.originalSize<0)
      throw Error('Arşivde geçersiz dosya boyutu var.');
    predicted+=item.originalSize;
    if(predicted>LIMIT_UNPACKED)throw Error('ZIP açılmış boyut sınırını aşıyor.');
    return true;
  }});
  const keys=Object.keys(unzipped);
  let total=0;
  for(const [name,data] of Object.entries(unzipped)){
    if(name.includes('\\')||name.includes('..')||name.startsWith('/')||
       (name!=='manifest.json'&&name!=='data/state.json'&&!ZIP_ASSET.test(name)))
      throw Error('Arşivde güvenli olmayan dosya yolu var.');
    total+=data.length;
    if(total>LIMIT_UNPACKED)throw Error('Arşiv açıldığında izin verilen boyutu aşıyor.');
  }
  if(!unzipped['manifest.json']||!unzipped['data/state.json'])throw Error('Arşiv başlığı/verisi eksik.');
  const manifest=JSON.parse(Buffer.from(unzipped['manifest.json']).toString('utf8'));
  validateManifest(manifest);
  const raw=Buffer.from(unzipped['data/state.json']);
  if(sha(raw)!==manifest.checksums['data/state.json'])throw Error('Arşiv JSON SHA-256 eşleşmiyor.');
  const incoming=JSON.parse(raw.toString('utf8'));
  checkState(incoming);
  const refs=refsIn(incoming);
  if(refs.length!==manifest.assets.length)throw Error('Arşivde varlık listesi eksik/fazla.');
  const expected=new Set(manifest.assets.map(a=>a.path));
  for(const ref of refs)if(!expected.has('assets/'+ref))
    throw Error('Arşiv kayıtları için varlık dosyası eksik.');
  if(keys.length!==manifest.assets.length+2)throw Error('Arşiv beklenmedik dosyalar içeriyor.');
  for(const item of manifest.assets){
    const data=unzipped[item.path];
    if(!data||data.length!==item.size||sha(data)!==item.sha256)
      throw Error('Arşiv varlığı eksik veya bozuk: '+item.path);
  }
  // All validation occurs before any archive mutation.
  return store.run(async()=>{
    const before=store.state;
    const next=copy(before);
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const oldRecords=new Map(next.records.map(r=>[r.id,r]));
    for(const r of incoming.records){
      if(oldRecords.has(r.id)){
        if(!same(oldRecords.get(r.id),r))throw Error('Kayıt kimliği çakışıyor, içe aktarma iptal edildi: '+r.id);
      }else next.records.push(r);
    }
    const oldLayers=new Map(next.layers.map(l=>[l.id,l]));
    for(const l of incoming.layers){
      if(oldLayers.has(l.id)){
        if(!same(oldLayers.get(l.id),l))throw Error('Katman kimliği çakışıyor, içe aktarma iptal edildi: '+l.id);
      }else next.layers.push(l);
    }
    next.projects=[...new Set([...next.projects,...incoming.projects])];
    for(const r of next.records)if(r.parentId&&!next.records.some(parent=>parent.id===r.parentId&&!parent.parentId))
      throw Error('Mevcut arşivle ziyaret bağlantısı uyuşmuyor.');
    // Existing UI preferences and credentials are always kept.
    for(const a of manifest.assets){
      const dest=store.assetFile(path.basename(a.path));
      await fsp.writeFile(dest,Buffer.from(unzipped[a.path]),{flag:'wx'}).catch(e=>{
        if(e.code!=='EEXIST')throw e;
      });
      if(await hashFile(dest)!==a.sha256)
        throw Error('Mevcut varlık dosyası SHA-256 uyuşmuyor: '+path.basename(dest));
    }
    await store.commit(next);
    return {projects:incoming.projects.length,records:incoming.records.length,
      layers:incoming.layers.length,assets:manifest.assets.length,
      newRecords:next.records.length-before.records.length,
      newLayers:next.layers.length-before.layers.length};
  });
}

module.exports={snapshot,refsIn,checkState,buildManifest,exportPortable,importPortable,validateManifest};
