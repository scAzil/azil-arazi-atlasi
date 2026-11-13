/*
 * AZIL-ATLAS/1 browser adapter (offline / no account / no cloud).
 * Requires ./atlas-standard.js and a browser-local fflate global.
 * Caller supplies getAsset(ref) and explicitly commits an imported snapshot.
 */
import {portableManifest,validatePortableManifest,ATLAS_CRS}
  from './atlas-standard.js';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const ASSET=/^([a-f0-9]{64})\.(jpg|png|webp|json|kml|kmz)$/;
const MAX_WEB_ZIP=180*1024*1024;
const MAX_WEB_UNPACKED=260*1024*1024;

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value);
async function checksum(data){
 const digest=await crypto.subtle.digest('SHA-256',bytes(data));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
function packState(state){
 if(!state||!Array.isArray(state.records)||!Array.isArray(state.layers)||
    !Array.isArray(state.projects))throw Error('Web verisi AZIL-ATLAS/1 yapısına dönüştürülmemiş.');
 const settings={};
 for(const name of ['theme','font','dense','basemap','photoMax'])
   if(state.settings?.[name]!==undefined)settings[name]=state.settings[name];
 const snapshot={version:1,projects:state.projects,records:state.records,
                 layers:state.layers,settings};
 const refs=new Set();
 for(const item of snapshot.records){
   for(const photo of item.photos||[]){
     if(photo.ref)refs.add(photo.ref);
     else if(photo.data)throw Error('Fotoğraf Blob referansı gerekiyor: '+item.title);
   }
 }
 for(const layer of snapshot.layers)
   if(layer.ref)refs.add(layer.ref);
 for(const ref of refs)
   if(!ASSET.test(ref))throw Error('Dosya SHA-256 adı geçersiz: '+ref);
 return {snapshot,refs:[...refs].sort()};
}
function getFflate(fflate){
 const lib=fflate||globalThis.fflate;
 if(!lib?.zipSync||!lib?.unzipSync)throw Error('fflate.js ZIP kütüphanesi yüklenmedi.');
 return lib;
}
export async function exportArchive({state,getAsset,appVersion,fflate,maxBytes=MAX_WEB_ZIP}){
 if(typeof getAsset!=='function')throw Error('Web arşiv varlık deposu bağlı değil.');
 const lib=getFflate(fflate);
 const {snapshot,refs}=packState(state);
 const raw=encoder.encode(JSON.stringify(snapshot));
 if(raw.byteLength>40*1024*1024)throw Error('Web JSON arşivi 40 MB sınırını aşıyor.');
 const files={'data/state.json':raw},assets=[];
 let total=raw.byteLength;
 for(const ref of refs){
   const file=await getAsset(ref);
   if(!file)throw Error('Arşive eklenecek dosya yok: '+ref);
   const data=bytes(await file.arrayBuffer());
   total+=data.byteLength;
   if(total>maxBytes)throw Error('Web arşiv sınırı aşıldı; büyük paftaları Windows üzerinden dışa aktarın.');
   const hash=await checksum(data);
   if(hash!==ref.split('.')[0])throw Error('Web varlığı SHA-256 doğrulaması başarısız: '+ref);
   const path='assets/'+ref;
   files[path]=data;
   assets.push({path,sha256:hash,size:data.byteLength,mediaType:file.type||'application/octet-stream'});
 }
 const manifest=portableManifest({
   platform:'web',appVersion,projectCount:snapshot.projects.length,
   recordCount:snapshot.records.length,layerCount:snapshot.layers.length,
   assets,checksums:{'data/state.json':await checksum(raw)}
 });
 files['manifest.json']=encoder.encode(JSON.stringify(manifest,null,2));
 const zipped=lib.zipSync(files,{level:0});
 if(zipped.byteLength>maxBytes)throw Error('Web arşivi boyut sınırını aşıyor.');
 return new Blob([zipped],{type:'application/zip'});
}

export async function readArchive(file,{fflate,maxBytes=MAX_WEB_ZIP}={}){
 if(!file||file.size>maxBytes)throw Error('Web içe aktarma dosyası çok büyük.');
 const lib=getFflate(fflate);
 const zipped=new Uint8Array(await file.arrayBuffer());
 let total=0;
 const contents=lib.unzipSync(zipped,{filter:item=>{
   const name=item.name;
   if(name.includes('..')||name.startsWith('/')||name.includes('\\')||
      !['manifest.json','data/state.json'].includes(name)&&!/^assets\/[a-f0-9]{64}\.(jpg|png|webp|json|kml|kmz)$/.test(name))
     throw Error('ZIP içinde güvenli olmayan yol var.');
   total+=item.originalSize;
   if(total>MAX_WEB_UNPACKED)throw Error('ZIP açıldığında çok büyük.');
   return true;
 }});
 if(!contents['manifest.json']||!contents['data/state.json'])throw Error('ZIP arşivinde gerekli dosyalar yok.');
 const manifest=JSON.parse(decoder.decode(contents['manifest.json']));
 validatePortableManifest(manifest);
 const json=contents['data/state.json'];
 if(await checksum(json)!==manifest.checksums['data/state.json'])
   throw Error('JSON SHA-256 doğrulaması başarısız.');
 const state=JSON.parse(decoder.decode(json));
 const {refs}=packState(state);
 if(refs.length!==manifest.assets.length||Object.keys(contents).length!==2+manifest.assets.length)
   throw Error('Arşivde beklenmedik/eksik varlık var.');
 const assets=new Map();
 for(const record of manifest.assets){
   const fileName=record.path.slice('assets/'.length);
   if(!refs.includes(fileName))throw Error('Atanmamış arşiv dosyası var.');
   const data=contents[record.path];
   if(!data||data.byteLength!==record.size||await checksum(data)!==record.sha256)
     throw Error('Arşiv dosyasının bütünlüğü bozuk: '+record.path);
   assets.set(fileName,new Blob([data],{type:record.mediaType}));
 }
 // IMPORTANT: This function intentionally DOES NOT mutate local browser storage.
 // Caller must explicitly confirm and implement a collision-safe merge.
 return {manifest,state,assets};
}

export function downloadArchive(blob,date=new Date()){
 const name='AZiL-Atlas-'+date.toISOString().slice(0,10)+'.atlas.zip';
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download=name;
 anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 return name;
}
