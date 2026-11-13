/*
 * AZiL Atlas shared local-first interchange and KML style rules.
 * Browser ESM; works without accounts, network or third-party APIs.
 * No actual user data is sent anywhere by this module.
 */
export const ATLAS_ARCHIVE_FORMAT = 'azil-atlas';
export const ATLAS_ARCHIVE_VERSION = 1;
export const ATLAS_CRS = 'EPSG:4326';

const validHex = /^#[0-9a-fA-F]{6}$/;
const clamp = (value,low,high,fallback) => {
  const n=Number(value);
  return Number.isFinite(n)?Math.max(low,Math.min(high,n)):fallback;
};
export const safeColor=(value,fallback='#267c9d')=>validHex.test(String(value||''))?value:fallback;

export function normalizeLayerStyle(value={},legacyColor='#267c9d'){
  const base=safeColor(legacyColor);
  const v=value&&typeof value==='object'?value:{};
  const p=v.point||{},l=v.line||{},a=v.polygon||{};
  return {
    point:{
      color:safeColor(p.color,base),
      fillColor:safeColor(p.fillColor,p.color&&safeColor(p.color)||base),
      radius:clamp(p.radius,2,22,6),
      weight:clamp(p.weight,0,12,2),
      opacity:clamp(p.opacity,0,1,1),
      fillOpacity:clamp(p.fillOpacity,0,1,.8)
    },
    line:{
      color:safeColor(l.color,base),
      weight:clamp(l.weight,.5,20,2),
      opacity:clamp(l.opacity,0,1,1)
    },
    polygon:{
      color:safeColor(a.color,base),
      weight:clamp(a.weight,0,20,2),
      opacity:clamp(a.opacity,0,1,1),
      fillColor:safeColor(a.fillColor,base),
      fillOpacity:clamp(a.fillOpacity,0,1,.12)
    }
  };
}

export function geometryStyle(geometry,layer) {
  const style=normalizeLayerStyle(layer.style,layer.color||'#267c9d');
  const type=geometry?.type||'';
  if(type==='Point'||type==='MultiPoint')return {...style.point};
  if(type==='Polygon'||type==='MultiPolygon')return {...style.polygon};
  if(type==='LineString'||type==='MultiLineString')return {...style.line};
  return {...style.line};
}

export function portableManifest({createdAt,platform,appVersion,projectCount,recordCount,layerCount,assets,checksums={}}){
  if(!['desktop','web'].includes(platform))throw Error('Archive platform must be desktop or web');
  const list=assets.map(asset=>{
    const sha256=String(asset.sha256||'').toLowerCase();
    if(!/^[a-f0-9]{64}$/.test(sha256))throw Error('Asset SHA-256 missing');
    if(!/^assets\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|json|kml|kmz)$/.test(asset.path))
      throw Error('Invalid asset path');
    if(!Number.isSafeInteger(asset.size)||asset.size<0)throw Error('Invalid asset length');
    return {path:asset.path,sha256,size:asset.size,mediaType:String(asset.mediaType||'application/octet-stream')};
  });
  return {
    format:ATLAS_ARCHIVE_FORMAT,
    schemaVersion:ATLAS_ARCHIVE_VERSION,
    kind:'snapshot',
    createdAt:createdAt||new Date().toISOString(),
    sourcePlatform:platform,
    appVersion:String(appVersion||'unknown'),
    crs:ATLAS_CRS,
    paths:{state:'data/state.json'},
    counts:{
      projects:Math.max(0,Number(projectCount)||0),
      records:Math.max(0,Number(recordCount)||0),
      layers:Math.max(0,Number(layerCount)||0),
      assets:list.length
    },
    assets:list,
    checksums:checksums
  };
}

export function validatePortableManifest(m){
  if(!m||m.format!==ATLAS_ARCHIVE_FORMAT||m.schemaVersion!==ATLAS_ARCHIVE_VERSION||
     m.kind!=='snapshot'||m.crs!==ATLAS_CRS||m.paths?.state!=='data/state.json')
    throw Error('AZiL Atlas arşiv biçimi/sürümü tanınmıyor.');
  if(!['desktop','web'].includes(m.sourcePlatform)||!Array.isArray(m.assets))
    throw Error('Arşiv başlık bilgisi geçersiz.');
  if(m.assets.length>100000)throw Error('Arşivde çok fazla varlık var.');
  const seen=new Set();
  for(const a of m.assets){
    if(!/^assets\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|json|kml|kmz)$/.test(a.path)||
      !/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.size)||a.size<0||
      seen.has(a.path)||a.path.split('/')[1].split('.')[0]!==a.sha256)
      throw Error('Arşiv varlık listesi hatalı veya yineleniyor.');
    seen.add(a.path);
  }
  if(!/^[a-f0-9]{64}$/.test(m.checksums?.['data/state.json']||''))
    throw Error('Arşiv veri bütünlüğü bilgisi eksik.');
  return true;
}
