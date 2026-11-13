'use strict';
/* AZiL Arazi Atlası Android — offline field workspace.
 * Only the map base tiles require the internet and are disabled by default.
 */
const $=id=>document.getElementById(id);
const escapeHtml=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const bridge=window.AndroidAtlas;
let state={version:1,projects:[],records:[],layers:[],settings:{}};
let map,osmLayer=null,markerGroup,geometryGroup,selectedCoord=null,formParent=null,styleId=null;
let toastTimeout=null,activeTab='map';
function toast(value){
 const el=$('toast');el.textContent=String(value||'');el.classList.add('visible');
 clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),3500);
}
function native(name,...args){
 if(!bridge||typeof bridge[name]!=='function')throw Error('Android uygulama köprüsü bulunamadı.');
 const value=JSON.parse(bridge[name].apply(bridge,args));
 if(value&&value.ok===false)throw Error(value.error||'Android işlemi başarısız.');
 return value;
}
function refresh(){
 state=native('getState');
 if(!Array.isArray(state.projects)||!Array.isArray(state.records)||!Array.isArray(state.layers))throw Error('Yerel arşiv biçimi okunamadı.');
 renderProjects();renderRecords();renderLayers();renderMap();renderArchiveInfo();
}
function openTab(tab){
 activeTab=tab;
 document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+tab));
 document.querySelectorAll('.tabs button').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
 if(tab==='map')setTimeout(()=>{map.invalidateSize();renderMap()},100);
}
function loadMap(){
 map=L.map('map',{zoomControl:false,preferCanvas:true,attributionControl:true,minZoom:2,maxZoom:20})
  .setView([36.42,36.38],9);
 L.control.zoom({position:'bottomright'}).addTo(map);
 markerGroup=L.layerGroup().addTo(map);geometryGroup=L.layerGroup().addTo(map);
 map.on('click',e=>{
  selectedCoord=[e.latlng.lat,e.latlng.lng];
  $('mapHint').textContent='Seçilen: '+e.latlng.lat.toFixed(6)+', '+e.latlng.lng.toFixed(6)+' · + Nokta ile kaydedin';
 });
}
function toggleBasemap(){
 if(osmLayer){
  map.removeLayer(osmLayer);osmLayer=null;
  $('basemapBtn').textContent='◫ OSM aç';$('basemapBtn').classList.remove('active');
  toast('Çevrimiçi harita kapatıldı. Kayıtlar çevrimdışı kullanılabilir.');return;
 }
 osmLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19,attribution:'&copy; OpenStreetMap contributors',updateWhenIdle:true,keepBuffer:1
 });
 osmLayer.addTo(map);$('basemapBtn').textContent='◫ OSM kapat';$('basemapBtn').classList.add('active');
 toast('OSM çevrimiçi altlık açıldı. Harita istekleri OSM sunucusuna gider.');
}
function renderMap(){
 if(!map)return;
 markerGroup.clearLayers();geometryGroup.clearLayers();
 for(const record of state.records){
  if(!Number.isFinite(record.lat)||!Number.isFinite(record.lon))continue;
  const color=record.parentId?'#d78638':'#27684f';
  const marker=L.circleMarker([record.lat,record.lon],{
   radius:record.parentId?5:8,weight:2,color:'#fff',fillColor:color,fillOpacity:.95
  }).addTo(markerGroup);
  marker.bindTooltip(escapeHtml(record.title));
  marker.on('click',()=>{openTab('records');setTimeout(()=>{
   const target=document.querySelector('[data-record="'+record.id+'"]');
   if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.style.outline='2px solid #438466';setTimeout(()=>target.style.outline='',1500);}
  },50)});
 }
 for(const layer of state.layers)if(layer.visible!==false&&layer.kind==='vector'&&layer.data){
  try{
   const style=normalStyle(layer.style);
   const vector=L.geoJSON(layer.data,{
    style:feature=>{
     const type=feature.geometry?.type||'';
     if(type.includes('Polygon'))return style.polygon;
     return style.line;
    },
    pointToLayer:(feature,latlng)=>L.circleMarker(latlng,style.point),
    onEachFeature:(feature,shape)=>{
     const name=feature.properties?.name||layer.name||'Katman';
     shape.bindTooltip(escapeHtml(name));
    }
   }).addTo(geometryGroup);
   vector._atlasId=layer.id;
  }catch(e){console.warn('Katman yüklenemedi:',layer.name,e);}
 }
}
const color=(v,f)=>/^#[a-f0-9]{6}$/i.test(String(v||''))?v:f;
const limit=(v,min,max,f)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
function normalStyle(x){
 const s=x||{},pt=s.point||{},ln=s.line||{},p=s.polygon||{};
 return{
  point:{radius:limit(pt.radius,2,22,6),weight:limit(pt.weight,0,12,2),color:color(pt.color,'#267c9d'),fillColor:color(pt.fillColor,'#267c9d'),opacity:limit(pt.opacity,0,1,1),fillOpacity:limit(pt.fillOpacity,0,1,.9)},
  line:{color:color(ln.color,'#267c9d'),weight:limit(ln.weight,.5,20,3),opacity:limit(ln.opacity,0,1,1)},
  polygon:{color:color(p.color,'#267c9d'),weight:limit(p.weight,0,20,2),opacity:limit(p.opacity,0,1,1),fillColor:color(p.fillColor,'#a2d6b2'),fillOpacity:limit(p.fillOpacity,0,1,.15)}
 };
}
function renderProjects(){
 const list=$('projectList');
 list.innerHTML=state.projects.length?state.projects.map(name=>
  '<div class="card"><h3>'+escapeHtml(name)+'</h3><p class="meta">'+
  state.records.filter(r=>r.project===name).length+' kayıt</p></div>').join(''):'<p class="muted">Henüz proje yok.</p>';
}
function renderRecords(){
 const query=$('search').value.trim().toLocaleLowerCase('tr-TR');
 const records=state.records.filter(r=>
  (r.title+' '+r.project+' '+(r.note||'')).toLocaleLowerCase('tr-TR').includes(query));
 const root=$('recordList');
 root.innerHTML=records.length?records.slice().reverse().map(r=>{
  const visits=state.records.filter(x=>x.parentId===r.id).length;
  const coords=Number.isFinite(r.lat)&&Number.isFinite(r.lon)?r.lat.toFixed(5)+', '+r.lon.toFixed(5):'Konum yok';
  const media=(r.photos||[]).map(p=>
   '<img loading="lazy" alt="Fotoğraf" width="90" height="78" style="object-fit:cover;border-radius:7px;margin:5px 5px 0 0" src="/local/'+encodeURIComponent(p.ref)+'">').join('');
  return '<article class="card" data-record="'+escapeHtml(r.id)+'"><h3>'+escapeHtml(r.title)+'</h3>'+
   '<div class="meta">'+escapeHtml(r.project)+' · '+escapeHtml(r.type||'Gözlem')+
   (r.parentId?' · Ziyaret':' · Ana nokta')+' · '+escapeHtml(new Date(r.date).toLocaleDateString('tr-TR'))+
   '</div><p>'+escapeHtml(r.note||'')+'</p><div class="meta">⌖ '+escapeHtml(coords)+' · '+visits+' bağlı ziyaret</div>'+
   '<div>'+media+'</div><div class="actions">'+
   (!r.parentId?'<button data-action="visit" data-id="'+escapeHtml(r.id)+'">+ Ziyaret</button>':'')+
   '<button data-action="photo" data-id="'+escapeHtml(r.id)+'">◫ Fotoğraf</button>'+
   (Number.isFinite(r.lat)?'<button data-action="zoom" data-id="'+escapeHtml(r.id)+'">Haritada göster</button>':'')+
   '</div></article>';
 }).join(''):'<p class="muted">Bu aramaya uygun kayıt yok.</p>';
}
function renderArchiveInfo(){
 $('archiveInfo').textContent=state.projects.length+' proje · '+state.records.length+' kayıt · '+
 state.layers.length+' katman · '+state.records.reduce((n,r)=>n+(r.photos||[]).length,0)+' fotoğraf';
}
function showRecordForm(parentId=null){
 const parent=state.records.find(r=>r.id===parentId);
 formParent=parent||null;
 $('recordForm').reset();
 $('parentId').value=parent?.id||'';
 $('recordTitle').textContent=parent?'Ziyaret ekle':'Yeni saha noktası';
 $('recProject').innerHTML=state.projects.map(x=>'<option>'+escapeHtml(x)+'</option>').join('');
 if(!state.projects.length){
  toast('Önce Projeler bölümünden bir proje oluşturun.');openTab('projects');return;
 }
 if(parent){
  $('recProject').value=parent.project;
  $('recTitle').value=parent.title+' · Ziyaret';
  $('recLat').value=parent.lat==null?'':parent.lat;
  $('recLon').value=parent.lon==null?'':parent.lon;
 }else if(selectedCoord){
  $('recLat').value=selectedCoord[0].toFixed(7);
  $('recLon').value=selectedCoord[1].toFixed(7);
 }
 $('recordDialog').showModal();
}
function saveRecord(e){
 e.preventDefault();
 const lat=$('recLat').value.trim(),lon=$('recLon').value.trim();
 if((lat==='')!==(lon==='')){toast('Enlem ve boylam birlikte girilmeli.');return;}
 const data={
  title:$('recTitle').value.trim(),project:$('recProject').value,
  type:$('recType').value,note:$('recNote').value.trim(),
  lat:lat===''?null:Number(lat),lon:lon===''?null:Number(lon),
  parentId:formParent?.id||null
 };
 if(!data.title){toast('Başlık boş olamaz.');return;}
 try{
  native('addRecord',JSON.stringify(data));$('recordDialog').close();selectedCoord=null;refresh();
  toast('Kayıt cihazda saklandı.');openTab('records');
 }catch(e){toast(e.message)}
}
function choosePhoto(id){
 let picker=$('photoPicker');
 if(!picker){picker=document.createElement('input');picker.type='file';picker.id='photoPicker';picker.accept='image/*';picker.capture='environment';picker.hidden=true;document.body.appendChild(picker);}
 picker.onchange=async()=>{
  const file=picker.files?.[0];if(!file)return;
  if(file.size>15*1024*1024){toast('Fotoğraf 15 MB sınırını aşıyor.');picker.value='';return;}
  try{
   const encoded=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(Error('Fotoğraf okunamadı.'));
    reader.readAsDataURL(file);
   });
   native('addPhoto',id,encoded);
   refresh();toast('Fotoğraf kaydedildi.');
  }catch(e){toast(e.message)}
  finally{picker.value='';}
 };
 picker.click();
}
function renderLayers(){
 const box=$('layerList');
 box.innerHTML=state.layers.length?state.layers.map(l=>{
  const style=normalStyle(l.style);
  return '<div class="layerRow" data-layer="'+escapeHtml(l.id)+'"><div class="stylebar" style="background:'+style.line.color+'"></div>'+
   '<h4>'+escapeHtml(l.name||'Katman')+'</h4><div class="actions">'+
   '<button data-laction="toggle" data-id="'+escapeHtml(l.id)+'">'+(l.visible===false?'Göster':'Gizle')+'</button>'+
   '<button data-laction="style" data-id="'+escapeHtml(l.id)+'">Renk / stil</button>'+
   '<button data-laction="zoom" data-id="'+escapeHtml(l.id)+'">Yaklaş</button>'+
   '</div></div>';
 }).join(''):'<p class="muted">Henüz KML/GeoJSON katmanı yok.</p>';
}
function openStyle(id){
 const layer=state.layers.find(x=>x.id===id);if(!layer)return;
 styleId=id;
 const style=normalStyle(layer.style);
 $('styleStroke').value=style.line.color;
 $('styleWeight').value=style.line.weight;
 $('styleFill').value=style.polygon.fillColor;
 $('styleOpacity').value=style.polygon.fillOpacity;
 $('opacityText').textContent=style.polygon.fillOpacity.toFixed(2);
 $('styleDialog').showModal();
}
function saveStyle(e){
 e.preventDefault();
 const layer=state.layers.find(x=>x.id===styleId);if(!layer)return;
 const style=normalStyle(layer.style);
 const stroke=$('styleStroke').value,weight=Number($('styleWeight').value);
 style.line.color=stroke;style.line.weight=weight;
 style.polygon.color=stroke;style.polygon.weight=weight;
 style.polygon.fillColor=$('styleFill').value;style.polygon.fillOpacity=Number($('styleOpacity').value);
 style.point.color=stroke;style.point.fillColor=$('styleFill').value;
 try{native('updateLayerStyle',styleId,JSON.stringify(style));$('styleDialog').close();refresh();toast('Katman stili kaydedildi.');}
 catch(e){toast(e.message);}
}
function textCoordinates(node){
 const tag=node?.getElementsByTagName('coordinates')[0];
 if(!tag)return [];
 return String(tag.textContent).trim().split(/\s+/).map(x=>{
  const arr=x.split(',').map(Number);
  return Number.isFinite(arr[0])&&Number.isFinite(arr[1])?[arr[0],arr[1]]:null;
 }).filter(Boolean);
}
function parseKML(content){
 const xml=new DOMParser().parseFromString(content,'application/xml');
 if(xml.getElementsByTagName('parsererror').length)throw Error('KML XML geçerli değil.');
 const placemarks=Array.from(xml.getElementsByTagName('Placemark')).slice(0,5000);
 const features=[];
 for(const item of placemarks){
  const name=item.getElementsByTagName('name')[0]?.textContent?.trim()||'KML ögesi';
  let geometry=null;
  const polygon=item.getElementsByTagName('Polygon')[0];
  const line=item.getElementsByTagName('LineString')[0];
  const point=item.getElementsByTagName('Point')[0];
  if(polygon){
   const outer=polygon.getElementsByTagName('outerBoundaryIs')[0];
   const coords=textCoordinates(outer||polygon);
   if(coords.length>=3){
    if(coords[0][0]!==coords[coords.length-1][0]||coords[0][1]!==coords[coords.length-1][1])coords.push([...coords[0]]);
    geometry={type:'Polygon',coordinates:[coords]};
   }
  }else if(line){
   const coords=textCoordinates(line);if(coords.length>=2)geometry={type:'LineString',coordinates:coords};
  }else if(point){
   const coords=textCoordinates(point);if(coords.length)geometry={type:'Point',coordinates:coords[0]};
  }
  if(geometry)features.push({type:'Feature',properties:{name},geometry});
 }
 if(!features.length)throw Error('Bu KML içinde desteklenen nokta, çizgi veya poligon bulunamadı.');
 return {type:'FeatureCollection',features};
}
async function loadLayer(file){
 if(!file)return;
 if(file.size>3*1024*1024)throw Error('Android beta için KML/GeoJSON dosyası en fazla 3 MB.');
 const raw=await file.text();
 let data;
 if(file.name.toLowerCase().endsWith('.kml'))data=parseKML(raw);
 else {
  data=JSON.parse(raw);
  if(data.type==='Feature')data={type:'FeatureCollection',features:[data]};
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('GeoJSON FeatureCollection bekleniyor.');
  if(data.features.length>5000)throw Error('Katman 5.000 ögeyi aşıyor.');
 }
 const name=file.name.replace(/\.[^.]+$/,'').slice(0,120);
 native('addLayer',JSON.stringify({kind:'vector',name,visible:true,data,style:normalStyle()}));
 refresh();toast('Katman eklendi: '+name);
}
function fitLayer(id){
 const layer=state.layers.find(x=>x.id===id);if(!layer)return;
 try{
  const candidate=L.geoJSON(layer.data);
  if(candidate.getBounds().isValid()){openTab('map');map.fitBounds(candidate.getBounds().pad(.15));}
 }catch(e){toast('Katmana yakınlaşılamadı.')}
}
window.Atlas={
 location:function(data){
  if(!data||data.ok===false){toast(data?.error||'GPS konumu bulunamadı.');return;}
  selectedCoord=[data.lat,data.lon];
  if($('recordDialog').open){$('recLat').value=data.lat.toFixed(7);$('recLon').value=data.lon.toFixed(7);}
  map.setView(selectedCoord,Math.max(map.getZoom(),15));
  toast('GPS konumu alındı. Hassasiyet: yaklaşık '+Math.round(data.accuracy||0)+' m.');
 },
 archiveDone:function(data){
  if(data?.ok){refresh();toast(data.message||'Arşiv işlemi tamamlandı.');}
  else toast(data?.error||'Arşiv işlemi başarısız.');
 }
};
window.atlasBack=function(){
 if($('styleDialog').open){$('styleDialog').close();return true;}
 if($('recordDialog').open){$('recordDialog').close();return true;}
 if(!$('layerPanel').hidden){$('layerPanel').hidden=true;return true;}
 if(activeTab!=='map'){openTab('map');return true;}
 return false;
};
document.querySelectorAll('.tabs button').forEach(el=>el.addEventListener('click',()=>openTab(el.dataset.tab)));
$('addRecordBtn').onclick=()=>showRecordForm();
$('addFromMapBtn').onclick=()=>showRecordForm();
$('cancelRecord').onclick=()=>$('recordDialog').close();
$('recordForm').onsubmit=saveRecord;
$('formGps').onclick=()=>bridge.requestLocation();
$('locateBtn').onclick=()=>bridge.requestLocation();
$('basemapBtn').onclick=toggleBasemap;
$('layerToggleBtn').onclick=()=>$('layerPanel').hidden=!$('layerPanel').hidden;
$('closeLayers').onclick=()=>$('layerPanel').hidden=true;
$('createProject').onclick=()=>{
 try{const name=$('newProject').value.trim();native('addProject',name);$('newProject').value='';refresh();toast('Proje oluşturuldu.');}
 catch(e){toast(e.message)}
};
$('newProject').addEventListener('keydown',e=>{if(e.key==='Enter')$('createProject').click()});
$('search').oninput=renderRecords;
$('recordList').addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;
 const r=state.records.find(x=>x.id===b.dataset.id);if(!r)return;
 if(b.dataset.action==='visit')showRecordForm(r.id);
 else if(b.dataset.action==='photo')choosePhoto(r.id);
 else if(b.dataset.action==='zoom'){openTab('map');map.setView([r.lat,r.lon],16);}
});
$('layerList').addEventListener('click',e=>{
 const button=e.target.closest('button[data-laction]');if(!button)return;
 const id=button.dataset.id,layer=state.layers.find(x=>x.id===id);if(!layer)return;
 try{
  if(button.dataset.laction==='style')openStyle(id);
  else if(button.dataset.laction==='zoom')fitLayer(id);
  else if(button.dataset.laction==='toggle'){native('toggleLayer',id);refresh();}
 }catch(error){toast(error.message)}
});
$('layerFile').onchange=async e=>{
 try{await loadLayer(e.target.files?.[0]);}
 catch(error){toast(error.message)}
 finally{e.target.value=''}
};
$('closeStyle').onclick=()=>$('styleDialog').close();
$('styleForm').onsubmit=saveStyle;
$('styleOpacity').oninput=()=>$('opacityText').textContent=Number($('styleOpacity').value).toFixed(2);
$('exportBtn').onclick=()=>bridge.requestExport();
$('importBtn').onclick=()=>bridge.requestImport();
try{loadMap();refresh();openTab('map');}catch(e){
 toast('Başlangıç hatası: '+e.message);
 $('archiveInfo').textContent='Başlangıç hatası: '+e.message;
}
