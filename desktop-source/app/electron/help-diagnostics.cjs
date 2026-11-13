'use strict';
/*
 * Privacy-preserving local diagnostics. Never includes paths, credentials,
 * coordinates, photo contents, notes or record/project names.
 */
const fs=require('node:fs/promises');

function diagnosticSnapshot(store,{version,platform,arch,electron}={}){
 const state=store?.state||{};
 const entries=Array.isArray(state.records)?state.records:[];
 const projects=Array.isArray(state.projects)?state.projects:[];
 const layers=Array.isArray(state.layers)?state.layers:[];
 const info={
  application:'AZiL Arazi Atlası',
  version:String(version||'unknown').slice(0,80),
  platform:String(platform||process.platform).slice(0,40),
  architecture:String(arch||process.arch).slice(0,40),
  electron:String(electron||process.versions.electron||'unknown').slice(0,50),
  archiveOpen:Boolean(store?.state),
  projectCount:projects.length,
  recordCount:entries.length,
  visitCount:entries.filter(x=>Boolean(x.parentId)).length,
  layerCount:layers.length,
  warningPresent:Boolean(store?.lastWarning),
  cloudSync:false
 };
 return info;
}

function formatDiagnostics(d){
 return [
  'AZiL Arazi Atlası — Tanılama',
  'Sürüm: '+d.version,
  'İşletim sistemi: '+d.platform+' ('+d.architecture+')',
  'Electron: '+d.electron,
  'Arşiv durumu: '+(d.archiveOpen?'Açık':'Açılamadı'),
  'Proje sayısı: '+d.projectCount,
  'Kayıt sayısı: '+d.recordCount,
  'Ziyaret sayısı: '+d.visitCount,
  'Katman sayısı: '+d.layerCount,
  'Uyarı bulunuyor: '+(d.warningPresent?'Evet':'Hayır'),
  'Bulut eşitleme: Yok',
  'Not: Kişisel ve kurumsal veriler, koordinatlar, dosya yolları, anahtarlar ve içerikler bu özete dahil edilmez.'
 ].join('\n');
}

async function archiveHealth(store,{limit=6000}={}){
 const state=store.state;
 const records=Array.isArray(state.records)?state.records:[];
 const layers=Array.isArray(state.layers)?state.layers:[];
 const projects=Array.isArray(state.projects)?state.projects:[];
 const recordIds=new Set(records.map(x=>x.id));
 let missingParents=0,visits=0;
 for(const r of records){
  if(r.parentId){
   visits++;
   if(!recordIds.has(r.parentId))missingParents++;
  }
 }
 const refs=new Set();
 for(const r of records)for(const photo of r.photos||[])if(photo.ref)refs.add(photo.ref);
 for(const layer of layers)if(layer.ref)refs.add(layer.ref);
 let checked=0,missingAssets=0;
 for(const ref of refs){
  if(checked>=limit)break;
  checked++;
  try{
   await fs.access(store.assetFile(ref));
  }catch{
   missingAssets++;
  }
 }
 return {
  projects:projects.length,
  records:records.length,
  visits,
  assets:refs.size,
  scannedAssets:checked,
  missingParents,
  missingAssets,
  partial:refs.size>checked
 };
}
module.exports={diagnosticSnapshot,formatDiagnostics,archiveHealth};
