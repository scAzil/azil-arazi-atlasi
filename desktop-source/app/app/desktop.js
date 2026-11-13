import {readMapFile,rasterLayer} from './pafta.js';
import {startReceiver} from './transfer.js';
import {normalizeLayerStyle,geometryStyle} from './atlas-standard.js';
import {HELP_TOPICS,helpLayout,helpArticle,searchResultsHTML} from './help-center.js';
const $=id=>document.getElementById(id),api=(n,a)=>window.desktop.call(n,a),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,view='overview',map,basemap,pointLayer,overlays=[],receiver,editPhotos=[],filter={q:'',project:'',type:'',from:'',to:''},measurement=[],measureMode=null,measureLayer,selectedPoint=null,reportIds=null;
window.atlasDirty=false;
let pickerMap=null,pickerMarker=null,pickerOverlays=[];
const mapPanels={menu:false,tools:false,layers:false,detail:false};
function updateMapWorkspace(){
 const active=view==='map';
 document.body.classList.toggle('map-workspace',active);
 document.body.classList.toggle('map-menu-open',active&&mapPanels.menu);
 if(!active)return;
 const toolbar=$('mapToolbar'),layers=$('layers'),detail=$('mapDetail');
 toolbar.hidden=!mapPanels.tools;
 layers.hidden=!mapPanels.layers;
 detail.hidden=!mapPanels.detail;
 document.querySelector('.mapGrid').classList.toggle('noLayers',!mapPanels.layers);
 document.querySelector('.mapGrid').classList.toggle('noDetail',!mapPanels.detail);
 const mapButtons={'map-sidebar':'menu','map-tools':'tools','toggle-layers':'layers','toggle-detail':'detail'};
 for(const [action,key] of Object.entries(mapButtons)){
  const control=document.querySelector('#mapQuickbar [data-action="'+action+'"]');
  if(control)control.setAttribute('aria-pressed',String(mapPanels[key]));
 }
 if(map){
  requestAnimationFrame(()=>map.invalidateSize({pan:false}));
  setTimeout(()=>{if(view==='map')map?.invalidateSize({pan:false})},230);
 }
}
function toggleMapPanel(key){
 mapPanels[key]=!mapPanels[key];
 if(key==='tools'&&mapPanels.tools)mapPanels.menu=false;
 if(key==='menu'&&mapPanels.menu)mapPanels.tools=false;
 updateMapWorkspace();
}

function discardDraft(){if(window.atlasDirty&&!confirm('Kaydedilmemiş değişikliklerden vazgeçilsin mi?')){const e=Error('Vazgeçildi');e.cancelled=true;throw e}window.atlasDirty=false}
function clearPicker(){pickerOverlays.forEach(l=>l.remove());pickerOverlays=[];pickerMap?.remove();pickerMap=null;pickerMarker=null}
const localDay=value=>{const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const names={overview:'Genel Bakış',projects:'Projeler',records:'Saha Kayıtları',map:'Harita',transfer:'Telefondan Aktar',reports:'Raporlar',trash:'Çöp Kutusu',settings:'Ayarlar'};
const photoUrl=p=>p.data||'atlas://app/asset/'+p.ref;
const formatBytes=bytes=>{const n=Number(bytes)||0;return n>=1073741824?(n/1073741824).toFixed(2)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B'};
async function preparePhoto(file){
 const choice=String(state.settings.photoMax||'original');
 const limit=Number(choice);
 if(choice==='original'||![1280,1920].includes(limit))
  return {name:file.name,data:await dataURL(file)};
 const image=await createImageBitmap(file);
 try{
  const scale=Math.min(1,limit/Math.max(image.width,image.height));
  if(scale>=1)return {name:file.name,data:await dataURL(file)};
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Fotoğraf dönüştürülemedi.');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const mime=file.type==='image/png'?'image/png':'image/jpeg';
  const encoded=await new Promise((resolve,reject)=>canvas.toBlob(
   b=>b?resolve(b):reject(Error('Fotoğraf kodlanamadı.')),mime,.88));
  if(encoded.size>15*1024*1024)throw Error('Küçültülmüş fotoğraf 15 MB sınırını aşıyor.');
  const ext=mime==='image/png'?'.png':'.jpg';
  return {name:file.name.replace(/\.[^.]*$/,'')+'-'+choice+ext,data:await dataURL(encoded)};
 }finally{image.close()}
}

const toast=msg=>{$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,9000)};
const guard=fn=>async(...args)=>{try{return await fn(...args)}catch(e){if(e.cancelled)return;toast(e.message||String(e));console.error(e)}};
async function refresh(){state=await api('state');document.body.classList.toggle('dark',state.settings.theme==='dark');document.body.classList.toggle('dense',!!state.settings.dense);document.documentElement.style.fontSize=(state.settings.font||15)+'px';$('status').textContent=state.archivePath+' · Son yedek: '+(state.lastBackup?new Date(state.lastBackup.at).toLocaleString('tr-TR'):'yok')+' · WGS84 / UTM 37N';render();if(state.warning)toast(state.warning)}
function modal(title,html){discardDraft();clearPicker();$('modal').innerHTML='<div class="dialogHead"><h2>'+esc(title)+'</h2><button data-action="close">Kapat</button></div>'+html;if(!$('modal').open)$('modal').showModal()}
async function openHelpCenter(topic='guide',initialSearch=''){
 const valid=HELP_TOPICS.some(item=>item.id===topic)?topic:'guide';
 modal('AZiL Arazi Atlası · Yardım Merkezi',helpLayout(valid));
 const root=$('atlasHelpRoot'),search=$('atlasHelpSearch'),article=$('atlasHelpArticle');
 let active=valid,diagnostics=null,health=null;
 const draw=()=>{
  root.querySelectorAll('.atlasHelpNav [data-help-topic]').forEach(button=>
    button.setAttribute('aria-current',button.dataset.helpTopic===active?'page':'false'));
  article.innerHTML=search.value.trim()?searchResultsHTML(search.value.trim()):
    helpArticle(active,{version:state.version,archivePath:state.archivePath,
                        backupPath:state.backupPath,diagnostics,health});
  article.scrollTop=0;
 };
 search.value=initialSearch;
 search.addEventListener('input',draw);
 root.addEventListener('click',guard(async e=>{
  const button=e.target.closest('[data-help-topic],[data-help-action]');
  if(!button)return;
  e.preventDefault();
  if(button.dataset.helpTopic){
    active=button.dataset.helpTopic;
    search.value='';
    draw();
    return;
  }
  const key=button.dataset.helpAction;
  if(key==='archive-folder')await api('open-folder');
  else if(key==='backup-folder')await api('help-open-backups');
  else if(key==='health'){
    const old=button.textContent;button.disabled=true;button.textContent='Kontrol ediliyor…';
    try{health=await api('help-archive-health');draw();}
    finally{if(button.isConnected){button.disabled=false;button.textContent=old}}
  }
  else if(key==='diagnostics-load'){
    const info=await api('help-diagnostics');
    diagnostics=Object.entries(info).map(([key,value])=>key+': '+value).join('\\n');
    draw();
  }
  else if(key==='diagnostics-copy'){
    await api('help-copy-diagnostics');
    toast('Kişisel veri içermeyen tanılama özeti panoya kopyalandı.');
  }
  else if(key==='website')await api('external','https://sbncifci.tr.gg/');
  else if(key==='github')await api('external','https://github.com/scAzil/azil-arazi-atlasi');
 }));
 draw();
}
function closeModal(){if(window.atlasDirty&&!confirm('Kaydedilmemiş değişikliklerden vazgeçilsin mi?'))return;window.atlasDirty=false;clearPicker();$('modal').close()}
function go(v){if(window.atlasDirty&&!confirm('Kaydedilmemiş değişikliklerden vazgeçilsin mi?'))return;window.atlasDirty=false;clearPicker();$('modal').close();if(v!=='map')mapPanels.menu=false;view=v;render()}
function filtered(){return state.records.filter(r=>(!filter.q||[r.title,r.project,r.note,r.type].join(' ').toLocaleLowerCase('tr').includes(filter.q.toLocaleLowerCase('tr')))&&(!filter.project||r.project===filter.project)&&(!filter.type||r.type===filter.type)&&(!filter.from||localDay(r.date)>=filter.from)&&(!filter.to||localDay(r.date)<=filter.to))}
function buttons(items){return items.map(([action,label,id=''])=>'<button data-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>').join('')}
function render(){if(!state)return;updateMapWorkspace();$('title').textContent=names[view];$('nav').innerHTML=Object.entries(names).filter(([k])=>k!=='records').map(([k,v])=>'<button data-action="nav" data-id="'+k+'" class="'+(k===view?'active':'')+'">'+v+'</button>').join('');$('mapView').hidden=view!=='map';$('content').hidden=view==='map';if(view==='map'){$('content').innerHTML='';mapUI();return}$('mapToolbar').innerHTML='';const out=$('content');
if(view==='overview')out.innerHTML='<div class="cards">'+[['Proje',state.projects.length],['Nokta / ziyaret',state.records.length],['Fotoğraf',state.records.reduce((n,r)=>n+r.photos.length,0)],['Çöp Kutusu',state.trash.length]].map(([label,n])=>'<div class="card"><small>'+label+'</small><b class="metric">'+n+'</b></div>').join('')+'</div><div class="panel"><h2>Sahadan gelenler güvende, arşiv elinin altında.</h2><p>Telefon kayıtlarını seçerek al. Fotoğrafları klasörlerden aç. Aynı noktayı ziyaretlerle izle.</p><div class="actions">'+buttons([['project','Yeni proje'],['nav','Tüm kayıtlar','records'],['nav','Haritayı aç','map'],['archive-export','Arşiv dosyası oluştur']])+'</div></div><div class="panel"><h2>Son kayıtlar</h2>'+recordList(state.records.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6))+'</div>';
if(view==='projects')out.innerHTML='<div class="actions">'+buttons([['project','＋ Yeni proje']])+'</div><br><div class="cards">'+state.projects.map(p=>{const rs=state.records.filter(r=>r.project===p);return '<article class="card"><h2>'+esc(p)+'</h2><p>'+rs.length+' nokta / ziyaret · '+rs.reduce((n,r)=>n+r.photos.length,0)+' fotoğraf</p><div class="actions">'+buttons([['project-open','Aç',p],['project-new-point','＋ Nokta',p],['project-rename','Adını değiştir',p],['project-trash','Çöp Kutusuna taşı',p]])+'</div></article>'}).join('')+'</div>';
if(view==='records')out.innerHTML=filterUI()+'<div class="panel">'+recordList(filtered())+'</div>';
if(view==='transfer')out.innerHTML='<div class="panel"><h2>Telefon → PC</h2><p>Telefondaki tüm kayıtları veya seçtiklerini aktar. PC arşivi telefona gönderilmez. Telefonda otomatik silme yapılmaz.</p><div class="actions">'+buttons([['qr-start','QR bağlantısı oluştur'],['qr-stop','Bağlantıyı kapat'],['json','JSON dosyasından al'],['archive-import','Atlas arşivini içe aktar']])+'</div><div id="qrArea">'+(receiver?receiver.html:'')+'</div><p id="transferState">'+esc(transferMessage)+'</p><div id="transferSummary">'+esc(summaryText())+'</div><pre>'+esc(transferIssues.join('\n'))+'</pre></div><p class="notice">Telefonda kayıtları kullandığınız tarayıcıda açın. QR oda anahtarı içerir; paylaşmayın. Aktarım tamamlandıktan sonra fotoğrafları kontrol edin; telefondaki kayıtları istediğiniz zaman kendiniz silin.</p>';
if(view==='trash')out.innerHTML='<div class="panel"><div class="actions">'+buttons([['trash-empty','Çöp Kutusunu boşalt']])+'</div><p>Otomatik silinmez. Kalıcı silme öncesinde yedek alınır; yedeklerdeki kopyalar saklama süresince korunur.</p>'+state.trash.map(t=>'<div class="record"><div><b>'+esc(t.value.title||t.value.name)+'</b><small>'+esc(t.kind==='photo'?'Fotoğraf':t.kind==='project'?'Proje':'Nokta / ziyaret')+' · '+new Date(t.at).toLocaleString('tr-TR')+'</small></div><div class="actions">'+buttons([['restore','Geri yükle',t.id],['purge','Kalıcı sil',t.id]])+'</div></div>').join('')+'</div>';
if(view==='reports')reportUI();if(view==='settings')settingsUI();}
function recordList(rs){return rs.length?rs.map(r=>'<article class="record"><div><h3>'+esc(r.title)+' '+(r.conflict?'<span class="badge">Çakışma</span>':'')+(r.parentId?'<span class="badge">Ziyaret</span>':'')+'</h3><small>'+esc(r.project)+' · '+new Date(r.date).toLocaleDateString('tr-TR')+' · '+esc(r.type)+'</small><p>'+esc(r.note.slice(0,150))+'</p><small>'+r.photos.length+' fotoğraf · '+(r.lat==null?'Konumsuz':r.lat.toFixed(6)+', '+r.lon.toFixed(6))+'</small></div><div class="actions">'+buttons([['detail','Aç',r.id],['edit','Düzenle',r.id],['visit','＋ Ziyaret',r.id]])+'</div></article>').join(''):'<p class="muted">Bu görünümde kayıt yok.</p>'}
function filterUI(){return '<div class="filters noPrint"><input id="search" placeholder="Ad, proje, açıklama ara" value="'+esc(filter.q)+'"><select id="projectFilter"><option value="">Tüm projeler</option>'+state.projects.map(p=>'<option '+(p===filter.project?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select><select id="typeFilter"><option value="">Tüm gözlem türleri</option>'+[...new Set(state.records.map(r=>r.type).filter(Boolean))].map(t=>'<option '+(filter.type===t?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select><button data-action="clear-filter">Filtreleri temizle</button><input id="from" type="date" value="'+filter.from+'"><input id="to" type="date" value="'+filter.to+'"></div>'}
function detail(id){const r=state.records.find(r=>r.id===id);if(!r)return;const parent=r.parentId||r.id,visits=state.records.filter(x=>x.id===parent||x.parentId===parent).sort((a,b)=>a.date.localeCompare(b.date));modal(r.title,'<p>'+esc(r.project)+' · '+new Date(r.date).toLocaleString('tr-TR')+'</p><p>'+esc(r.note).replace(/\n/g,'<br>')+'</p><p>Koordinat: '+esc(r.lat)+' / '+esc(r.lon)+'</p><div class="photos">'+r.photos.map(p=>'<a href="'+photoUrl(p)+'" data-action="photo" data-url="'+esc(photoUrl(p))+'"><img src="'+photoUrl(p)+'" alt="'+esc(p.name)+'"></a>').join('')+'</div><br><div class="actions">'+buttons([['edit','Düzenle',id],['visit','Yeni ziyaret',id],['folder','Fotoğraf klasörü',id],['trash-record','Çöp Kutusuna taşı',id],['map-point','Haritada gör',id]])+'</div><h3 style="margin-top:25px">Ziyaretler</h3>'+visits.map(x=>'<p><button data-action="detail" data-id="'+esc(x.id)+'">'+new Date(x.date).toLocaleDateString('tr-TR')+' · '+esc(x.title)+'</button></p>').join('')+(visits.length>1?buttons([['compare','Ziyaretleri karşılaştır',parent]]):''))}
function edit(id,project,parentId){discardDraft();const r=state.records.find(x=>x.id===id)||{id:crypto.randomUUID(),title:'',project:project||filter.project||state.projects[0]||'',date:new Date().toISOString(),type:'Akarsu',note:'',lat:null,lon:null,photos:[],technical:{},parentId:parentId||null};editPhotos=r.photos.slice();modal(id?'Noktayı düzenle':parentId?'Yeni ziyaret':'Yeni nokta','<form id="recordForm"><div class="grid"><label>Başlık<input name="title" required maxlength="200" value="'+esc(r.title)+'"></label><label>Proje<input name="project" required list="projects" value="'+esc(r.project)+'"><datalist id="projects">'+state.projects.map(p=>'<option>'+esc(p)+'</option>').join('')+'</datalist></label><label>Tarih<input name="date" required type="datetime-local" value="'+new Date(new Date(r.date)-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)+'"></label><label>Gözlem türü<select name="type">'+[...new Set([r.type,'Akarsu','Dere','Kaynak','Baraj','Gölet','Kuyu','Kanal','Diğer'])].filter(Boolean).map(t=>'<option '+(t===r.type?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label><label>Enlem<input name="lat" type="number" step="any" min="-90" max="90" value="'+(r.lat??'')+'"></label><label>Boylam<input name="lon" type="number" step="any" min="-180" max="180" value="'+(r.lon??'')+'"></label></div><button type="button" id="chooseMap">Haritadan konum seç</button><div id="pointMap" hidden style="height:360px;margin:12px 0"></div><p id="pointMapHint" class="muted">Haritaya tıklayarak koordinatı seçebilirsin. Görünür paftaların ve veri katmanların da gösterilir.</p><label>Açıklama<textarea name="note" rows="5">'+esc(r.note)+'</textarea></label><label>Yeni fotoğraflar<input id="photosInput" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div id="editPhotos" class="photos"></div><p>Silinen fotoğraflar kayıt tamamlanınca Çöp Kutusuna taşınır.</p><button class="primary" type="submit">Kaydet</button></form>');renderEditPhotos();$('recordForm').elements.project.readOnly=!!r.parentId;$('chooseMap').onclick=guard(()=>openPointPicker());$('recordForm').oninput=()=>window.atlasDirty=true;$('photosInput').onchange=guard(async e=>{for(const f of e.target.files){if(f.size>15*1024*1024)throw Error('Fotoğraf en fazla 15 MB olabilir');editPhotos.push(await preparePhoto(f))}window.atlasDirty=true;renderEditPhotos()});$('recordForm').onsubmit=guard(async e=>{e.preventDefault();const submit=e.target.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;try{const f=new FormData(e.target),lat=f.get('lat')===''?null:Number(f.get('lat')),lon=f.get('lon')===''?null:Number(f.get('lon'));const result=await api('save',{...r,title:f.get('title').trim(),project:f.get('project').trim(),date:new Date(f.get('date')).toISOString(),type:f.get('type'),lat,lon,note:f.get('note'),photos:editPhotos,source:lat===null?'none':lat===r.lat&&lon===r.lon?r.source||'manual':'manual',accuracy:lat===r.lat&&lon===r.lon?r.accuracy??null:null,updatedAt:new Date().toISOString()});window.atlasDirty=false;clearPicker();$('modal').close();await refresh();toast(result.warning||'Nokta ve fotoğraflar kaydedildi.')}finally{submit.disabled=false}});}
function openPointPicker(){
 const el=$('pointMap');el.hidden=false;if(pickerMap){pickerMap.invalidateSize();return}
 const form=$('recordForm'),lat=form.elements.lat.value,lon=form.elements.lon.value;
 const has=lat!==''&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon));
 pickerMap=L.map(el,{preferCanvas:true}).setView(has?[Number(lat),Number(lon)]:map?map.getCenter():[36.3,36.35],has?16:map?map.getZoom():10);
 const kind=state.settings.basemap||'osm';let url,attribution,max=19;
 if(kind==='osm'){url='https://tile.openstreetmap.org/{z}/{x}/{y}.png';attribution='© OpenStreetMap contributors'}
 if(kind==='nasa'){url='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';attribution='NASA GIBS';max=8}
 if(kind==='esri'&&state.settings.esriKey){url='https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token='+encodeURIComponent(state.settings.esriKey);attribution='Powered by Esri'}
 if(url)L.tileLayer(url,{attribution,maxNativeZoom:max,maxZoom:22}).addTo(pickerMap);
 const masks=maskChoices();for(const layer of state.layers.filter(l=>l.visible!==false)){if(layer.kind==='raster')pickerOverlays.push(rasterLayer(layer,layer.clip?masks.find(m=>m.id===layer.maskId)?.feature:null).addTo(pickerMap));else if(layer.data)pickerOverlays.push(L.geoJSON(layer.data,{interactive:false,style:{color:layer.color||'#b58c3a',weight:2,fillOpacity:.08},pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:4,interactive:false})}).addTo(pickerMap))}
 const mark=ll=>{if(pickerMarker)pickerMarker.setLatLng(ll);else pickerMarker=L.circleMarker(ll,{radius:9,color:'#d14d2b',fillOpacity:.9}).addTo(pickerMap);pickerMarker.bringToFront()};
 if(has)mark([Number(lat),Number(lon)]);pickerMap.on('click',e=>{form.elements.lat.value=e.latlng.lat.toFixed(7);form.elements.lon.value=e.latlng.lng.toFixed(7);window.atlasDirty=true;mark(e.latlng);$('pointMapHint').textContent='Konum seçildi. Noktayı kaydettiğinde arşive yazılacak.'});setTimeout(()=>pickerMap?.invalidateSize(),50);
}
function projectDialog(existing){modal(existing?'Proje adını değiştir':'Yeni proje','<form id="projectForm"><label>Proje adı<input name="name" required maxlength="200" value="'+esc(existing||'')+'"></label><button type="submit">Kaydet</button></form>');$('projectForm').oninput=()=>window.atlasDirty=true;$('projectForm').onsubmit=guard(async e=>{e.preventDefault();const name=e.target.elements.name.value.trim();if(!name)throw Error('Proje adı boş olamaz');const b=e.target.querySelector('button');if(b.disabled)return;b.disabled=true;try{await api('project',existing?{name:existing,newName:name}:{name});if(filter.project===existing)filter.project=name;window.atlasDirty=false;$('modal').close();await refresh()}finally{b.disabled=false}});$('projectForm').elements.name.focus()}
function renderEditPhotos(){$('editPhotos').innerHTML=editPhotos.map((p,i)=>'<div class="photo"><img src="'+photoUrl(p)+'" alt="'+esc(p.name)+'"><button type="button" data-action="remove-photo" data-id="'+i+'">Kaldır</button></div>').join('')}
const dataURL=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)});
async function exportAtlas(){
 const result=await api('archive-export');
 if(result)toast('Güncel AZiL arşivi dışa aktarıldı: '+result.records+' kayıt, '+result.assets+' dosya.');
}
async function importAtlas(){
 const result=await api('archive-import');
 if(result){await refresh();toast('Atlas arşivi içe aktarıldı: '+result.newRecords+' yeni kayıt, '+result.newLayers+' yeni katman.');}
}
function settingsUI(){$('content').innerHTML='<div class="grid"><section class="panel"><h2>Görünüm</h2><label>Tema<select id="theme"><option value="light">Açık</option><option value="dark">Koyu</option></select></label><label>Yazı boyutu<input id="fontSize" type="number" min="12" max="22" value="'+state.settings.font+'"></label><label><input id="dense" type="checkbox" '+(state.settings.dense?'checked':'')+'> Sıkı liste görünümü</label><label>Yeni fotoğrafların uzun kenarı<select id="photoMax"><option value="original">Orijinal (varsayılan)</option><option value="1920">1920 piksel</option><option value="1280">1280 piksel</option></select></label><small>Yalnızca yeni eklenen fotoğraflara uygulanır; özgün dosyanız değiştirilmez. Yeniden boyutlandırma EXIF bilgisini kaldırabilir.</small><button data-action="save-settings">Görünümü kaydet</button><h2 style="margin-top:25px">Harita sağlayıcısı</h2><label>Esri API anahtarı<input id="esriKey" type="password" autocomplete="off" value="'+esc(state.settings.esriKey||'')+'"></label><small>Yüksek çözünürlüklü Esri uydu altlığı için kendi yetkili anahtarınızı girin. Anahtar yerel ayarlarda saklanır; yedeklere dahil olur.</small><button data-action="save-key">Anahtarı kaydet</button><p>Google / Yandex düğmeleri seçilen konumu tarayıcıda açar. Bu sağlayıcıların uydu görüntüsü uygulamaya izinsiz gömülmez.</p></section><section class="panel"><h2>Arşiv standardı · AZIL-ATLAS/1</h2><button type="button" data-action="help-data">? Arşiv yardımı</button><p>'+esc(state.archivePath)+'</p><p>Bu program hesap veya bulut eşitleme kullanmaz. Taşınabilir <b>.atlas.zip</b> dosyası yalnızca <b>güncel projeler, noktalar, bağlı ziyaretler, katmanlar, fotoğraflar ve paftalardan</b> oluşur. Eski sürüm geçmişi, Çöp Kutusu, geçmiş yedekler ve özel API anahtarları dosyaya konmaz.</p><div class="actions">'+buttons([['archive-export','Arşiv dosyası oluştur'],['archive-import','Atlas arşivini içe aktar'],['folder','Arşiv klasörünü aç'],['repair-folders','Fotoğraf klasörlerini onar']])+'</div><p>Arşiv içe aktarma mevcut kayıtları silmez, yalnızca yeni kimlikleri ekler; çakışan kayıtlarda işlemi durdurur. Arşiv dosyasını PC ile web arasında elle taşıyabilirsiniz. Büyük paftalı dosyalarda boyut sınırları uygulanır.</p><p>Mevcut <b>Arsiv</b> ve <b>Yedekler</b> klasörlerindeki geçmiş dosyalar kendiliğinden silinmez. Eski yedekten dönme menüleri kaldırıldı. Gerçek saha ve kurumsal verilerinizi herkese açık GitHub deposuna yüklemeyin.</p><div id="storageSummary" class="notice" aria-live="polite">Depolama kullanımını hesaplamak için düğmeye basın.</div><button data-action="storage-info">Depolama durumunu göster</button></section></div>';$('theme').value=state.settings.theme;$('photoMax').value=state.settings.photoMax||'original'}
function about(){modal('Şaban Çifçi · AZiL','<div class="aboutHero"><h2>Mühendis.<br>Yazar ve üretici.</h2><p>Biyosistem mühendisliği, su kaynakları ve haritalarla başlayan mesleki yolculuğum; zaman içinde CBS, bilgi yönetimi, web uygulamaları, oyunlar ve hikâyelerle genişledi. AZiL ise bu üretimlerin yaratıcı tarafı.</p></div><h3 style="margin-top:25px">Mesleki yolculuk</h3><p><b>2026 — Devam ediyor · DSİ Hatay</b><br>Biyosistem Mühendisi / Etüt Plan çalışmaları. Su kaynakları, havza planlama, harita ve mekânsal veri çalışmalarının kesiştiği mesleki alan.</p><p><b>2018 — 2026 · DSİ Yozgat</b><br>Biyosistem Mühendisi. DSİ’deki mesleki deneyimimin ilk uzun dönemi.</p><h3>Eğitim</h3><table><tr><th>Dönem</th><th>Öğrenim</th></tr><tr><td>2015–2019</td><td>KSÜ · Biyosistem Mühendisliği, yüksek lisans</td></tr><tr><td>2011–2015</td><td>KSÜ · Biyosistem Mühendisliği, lisans. 2012–2013 bölüm birinciliği; onur derecesiyle mezuniyet.</td></tr><tr><td>2020–2024</td><td>Anadolu Üniversitesi · Coğrafi Bilgi Sistemleri, ön lisans</td></tr><tr><td>2021–2023</td><td>Atatürk Üniversitesi · Bilgi Yönetimi, ön lisans</td></tr></table><h3 style="margin-top:25px">Yazarlık ve üretim</h3><p><b>HANOK – AZİL DOSYALARI</b><br>Kalp İzleri Teorisi etrafında şekillenen; hafıza, sevgi, zaman ve insanın ardında bıraktığı izlerle ilgilenen bilimkurgu romanım.</p><p>Web uygulamaları, oyunlar ve harita araçları da üretim alanlarım arasında.</p><h3>İlgi alanları</h3><p>Su kaynakları · Havza planlama · CBS ve haritalar · Bilgi yönetimi · Web uygulamaları · Oyun geliştirme · Yazarlık · Grafik tasarım · Sinema ve diziler · Müzik · Amatör astronomi</p><h3>Bir şeyler geride kalsın diye.</h3><p>Bu siteyi yalnızca yaptığım projeleri sıralamak için değil; neye ilgi duyduğumu, ne ürettiğimi ve zaman içinde nasıl değiştiğimi bir yerde toplamak için tutuyorum. Yıllar sonra buraya gelen biri, sayfaların arasında benden küçük izler bulabilsin.</p><div class="actions">'+buttons([['external','Web sitemi ziyaret et','https://sbncifci.tr.gg/'],['external','Hakkımda sayfası','https://sbncifci.tr.gg/Hakkimda.htm']])+'</div><small style="margin-top:20px">Arazi Atlası '+esc(state.version)+' · Biyografi kaynağı: Hakkımda sayfası, 17 Ekim 2026.</small>')}
function compare(parent){const rs=state.records.filter(r=>r.id===parent||r.parentId===parent).sort((a,b)=>a.date.localeCompare(b.date));modal('Ziyaretleri karşılaştır','<div class="cards">'+rs.map(r=>'<article class="card"><h3>'+new Date(r.date).toLocaleString('tr-TR')+'</h3><p>'+esc(r.note)+'</p><small>'+r.lat+', '+r.lon+'</small><div class="photos">'+r.photos.map(p=>'<img src="'+photoUrl(p)+'" alt="'+esc(p.name)+'">').join('')+'</div></article>').join('')+'</div>')}
function reportUI(){const rs=reportIds?state.records.filter(r=>reportIds.includes(r.id)):filtered();$('content').innerHTML='<div class="noPrint">'+filterUI()+'<div class="actions">'+buttons([['pdf','PDF kaydet'],['export-json','JSON dışa aktar'],['export-csv','CSV dışa aktar'],['export-kml','KML dışa aktar'],['export-geo','GeoJSON dışa aktar']])+'</div><p>'+rs.length+' kayıt seçili. Üstteki filtreler rapor kapsamını belirler.</p></div><div class="panel" id="report"><h2>Saha Çalışma Raporu</h2><p>'+new Date().toLocaleDateString('tr-TR')+' · '+rs.length+' nokta / ziyaret</p>'+rs.map(r=>'<section class="report-record"><h3>'+esc(r.project)+' / '+esc(r.title)+'</h3><p>'+new Date(r.date).toLocaleString('tr-TR')+' · '+esc(r.type)+'</p><p>WGS84: '+r.lat+', '+r.lon+'</p><p>'+esc(r.note).replace(/\n/g,'<br>')+'</p>'+r.photos.map(p=>'<img class="report-photo" src="'+photoUrl(p)+'" alt="'+esc(p.name)+'">').join('')+'<hr></section>').join('')+'</div>'}
async function exportData(kind){const rs=filtered();let text,name;const x=v=>esc(v);if(kind==='json'){const full=[];for(const r of rs){const photos=[];for(const p of r.photos)photos.push({name:p.name,data:await dataURL(await (await fetch(photoUrl(p))).blob())});full.push({...r,photos})}text=JSON.stringify({app:'Dijital Saha Defteri',version:1,schemaVersion:'1.1',projects:state.projects.map(name=>({id:'desktop-'+name,name})),records:full},null,2);name='Arazi-Atlasi.json'}else if(kind==='csv'){const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';text='\uFEFF'+[['Kimlik','Proje','Başlık','Tarih','Tür','Enlem','Boylam','Not'],...rs.map(r=>[r.id,r.project,r.title,r.date,r.type,r.lat,r.lon,r.note])].map(row=>row.map(cell).join(';')).join('\r\n');name='Arazi-Atlasi.csv'}else if(kind==='geo'){text=JSON.stringify({type:'FeatureCollection',features:rs.map(r=>({type:'Feature',geometry:r.lat==null?null:{type:'Point',coordinates:[r.lon,r.lat]},properties:{id:r.id,title:r.title,project:r.project,date:r.date,note:r.note,parentId:r.parentId||null}}))},null,2);name='Arazi-Atlasi.geojson'}else{text='<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>'+rs.filter(r=>r.lat!=null).map(r=>'<Placemark><name>'+x(r.title)+'</name><description>'+x(r.note)+'</description><Point><coordinates>'+r.lon+','+r.lat+'</coordinates></Point></Placemark>').join('')+'</Document></kml>';name='Arazi-Atlasi.kml'}if(await api('export',{name,text}))toast('Dosya kaydedildi.')}
function mapUI(){$('mapToolbar').innerHTML=filterUI()+'<div class="actions"><select id="baseSelect" style="width:220px"><option value="osm">OpenStreetMap</option><option value="nasa">NASA Blue Marble · genel uydu</option><option value="esri">Esri uydu · API anahtarı</option><option value="none">Altlık yok / çevrimdışı</option></select>'+buttons([['pafta','KML / KMZ veri ve pafta ekle'],['index','Pafta indeksi ekle'],['toggle-layers','Katman paneli'],['toggle-detail','Bilgi paneli'],['measure-line','Mesafe ölç'],['measure-area','Alan ölç'],['measure-clear','Ölçümü temizle'],['google','Google’da aç'],['yandex','Yandex’te aç']])+'</div><small id="mapInfo">Koordinatlar WGS84. Ölçümler yaklaşık; resmî ölçüm yerine geçmez.</small>';
if(!map){map=L.map('map',{preferCanvas:true}).setView([36.3,36.35],10);pointLayer=L.layerGroup().addTo(map);measureLayer=L.layerGroup().addTo(map);map.on('click',e=>{const p=e.latlng;const utm=proj4('EPSG:4326','+proj=utm +zone=37 +datum=WGS84 +units=m +no_defs',[p.lng,p.lat]);$('mapInfo').textContent='WGS84: '+p.lat.toFixed(6)+', '+p.lng.toFixed(6)+' · UTM 37N: '+utm[0].toFixed(2)+' / '+utm[1].toFixed(2);if(measureMode){measurement.push([p.lng,p.lat]);drawMeasure()}})}$('baseSelect').value=state.settings.basemap||'osm';$('baseSelect').onchange=guard(async()=>{await api('settings',{basemap:$('baseSelect').value});state.settings.basemap=$('baseSelect').value;setBase()});setBase();drawMap();updateMapWorkspace();setTimeout(()=>map.invalidateSize({pan:false}),50);}
function setBase(){if(basemap)map.removeLayer(basemap);const val=$('baseSelect').value;let url,attrib,max=19;if(val==='none')return;if(val==='osm'){url='https://tile.openstreetmap.org/{z}/{x}/{y}.png';attrib='© OpenStreetMap contributors'}if(val==='nasa'){url='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';attrib='NASA GIBS · Blue Marble (genel görünüm, saha ayrıntısı değildir)';max=8}if(val==='esri'){if(!state.settings.esriKey){toast('Esri uydu için Ayarlar bölümünde yetkili API anahtarı girin.');return}url='https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token='+encodeURIComponent(state.settings.esriKey);attrib='Powered by Esri · Esri, Maxar, Earthstar Geographics and the GIS User Community'}basemap=L.tileLayer(url,{attribution:attrib,maxNativeZoom:max,maxZoom:22}).on('tileerror',()=>{$('mapInfo').textContent='Altlık yüklenemedi. İnternet / sağlayıcı erişimini kontrol edin. Yerel pafta ve noktalar korunur.'}).addTo(map);basemap.bringToBack()}
function maskChoices(){return state.layers.filter(l=>l.kind==='index').flatMap(l=>l.data.features.map((feature,i)=>({id:l.id+':'+i,name:(feature.properties?.name||'Poligon '+(i+1)),feature})))}
function styleField(label,name,type,value,min,max,step){
 const attrs=type==='number'?' min="'+min+'" max="'+max+'" step="'+step+'"':'';
 return '<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'"'+attrs+' required></label>';
}
function openLayerStyleEditor(id){
 const layer=state.layers.find(l=>l.id===id);
 if(!layer||!['vector','index'].includes(layer.kind))throw Error('Bu katmanın çizim stili bulunmuyor.');
 const defaults=layer.kind==='index'?'#b58c3a':'#267c9d';
 const style=normalizeLayerStyle(layer.style,layer.color||defaults);
 const sections=[
  ['Noktalar',[
   ['Nokta çizgi rengi','point.color','color',style.point.color],
   ['Nokta iç rengi','point.fillColor','color',style.point.fillColor],
   ['Nokta yarıçapı (piksel)','point.radius','number',style.point.radius,2,22,1],
   ['Nokta kenar kalınlığı (piksel)','point.weight','number',style.point.weight,0,12,.5],
   ['Nokta kenar görünürlüğü (0–1)','point.opacity','number',style.point.opacity,0,1,.05],
   ['Nokta iç saydamlığı (0 = boş)','point.fillOpacity','number',style.point.fillOpacity,0,1,.05]
  ]],
  ['Çizgiler',[
   ['Çizgi rengi','line.color','color',style.line.color],
   ['Çizgi kalınlığı (piksel)','line.weight','number',style.line.weight,.5,20,.5],
   ['Çizgi görünürlüğü (0–1)','line.opacity','number',style.line.opacity,0,1,.05]
  ]],
  ['Alanlar / poligonlar',[
   ['Dış çizgi rengi','polygon.color','color',style.polygon.color],
   ['Dış çizgi kalınlığı (piksel)','polygon.weight','number',style.polygon.weight,0,20,.5],
   ['Dış çizgi görünürlüğü (0–1)','polygon.opacity','number',style.polygon.opacity,0,1,.05],
   ['İç dolgu rengi','polygon.fillColor','color',style.polygon.fillColor],
   ['İç dolgu görünürlüğü (0 = tamamen saydam)','polygon.fillOpacity','number',style.polygon.fillOpacity,0,1,.05]
  ]]
 ];
 const body='<form id="layerStyleForm"><p>Bu ayarlar katmanın tüm nokta, çizgi ve alanlarına ayrı ayrı uygulanır. Alanın ortasını boş bırakmak için <b>İç dolgu görünürlüğü = 0</b> seçin.</p>'+
 sections.map(([title,fields])=>'<fieldset class="styleGroup"><legend>'+title+'</legend><div class="styleFields">'+
 fields.map(([label,name,type,value,min,max,step])=>styleField(label,name,type,value,min,max,step)).join('')+
 '</div></fieldset>').join('')+
 '<div class="actions"><button type="button" data-action="layer-style-reset" data-id="'+esc(id)+'">Varsayılana dön</button><button class="primary" type="submit">Stili kaydet</button></div></form>';
 modal('Katman görünümü · '+layer.name,body);
 $('layerStyleForm').onsubmit=guard(async event=>{
  event.preventDefault();
  const raw=Object.fromEntries(new FormData(event.currentTarget));
  const changes={point:{},line:{},polygon:{}};
  for(const [key,val] of Object.entries(raw)){
   const [type,field]=key.split('.');
   if(type in changes&&field)changes[type][field]=val;
  }
  const updated=normalizeLayerStyle(changes,layer.color||defaults);
  await api('layer',{...layer,style:updated});
  $('modal').close();
  await refresh();
  toast('Katman stili kaydedildi.');
 });
}
function drawMap(){pointLayer.clearLayers();for(const r of filtered().filter(r=>r.lat!=null)){const marker=L.circleMarker([r.lat,r.lon],{radius:r.parentId?5:8,color:r.conflict?'#b66c2c':'#294b35',fillColor:'#b7d992',fillOpacity:.9}).addTo(pointLayer);marker.bindTooltip(r.title);marker.on('click',()=>{selectedPoint=r.id;mapPanels.detail=true;updateMapWorkspace();$('mapDetail').innerHTML='<h3>'+esc(r.title)+'</h3><p>'+esc(r.project)+'</p><p>'+esc(r.note)+'</p><div class="photos">'+r.photos.slice(0,2).map(p=>'<img src="'+photoUrl(p)+'" alt="">').join('')+'</div><div class="actions">'+buttons([['detail','Aç',r.id],['edit','Düzenle',r.id],['visit','＋ Ziyaret',r.id]])+'</div>'})}for(const o of overlays)o.remove();overlays=[];const masks=maskChoices();for(const l of state.layers){if(l.visible===false)continue;if(l.kind==='index')overlays.push(L.geoJSON(l.data,{style:f=>l.style?geometryStyle(f.geometry,l):{color:'#b58c3a',weight:2,fillOpacity:.03}}).addTo(map));if(l.kind==='raster'){const mask=l.clip?masks.find(m=>m.id===l.maskId)?.feature:null;overlays.push(rasterLayer(l,mask).addTo(map))}if(l.kind==='vector')overlays.push(L.geoJSON(l.data,{style:f=>geometryStyle(f.geometry,l),pointToLayer:(f,ll)=>L.circleMarker(ll,geometryStyle(f.geometry,l)),onEachFeature:(f,layer)=>{const p=f.properties||{};layer.bindPopup('<b>'+esc(p.name||p.title||'Öğe')+'</b>'+(p.folder?'<p>'+esc(p.folder)+'</p>':'')+(p.description?'<p>'+esc(p.description)+'</p>':'')+Object.entries(p.attributes||{}).map(([k,v])=>'<div><b>'+esc(k)+':</b> '+esc(v)+'</div>').join(''))}}).addTo(map))}
$('layers').innerHTML='<h3>Katmanlar</h3><button data-action="reference">Asi hazır katmanları</button><p><small>Paftalar yerel arşivdedir; telefona gönderilmez.</small></p>'+state.layers.map(l=>'<div class="layer"><label><input type="checkbox" data-layer-visible="'+esc(l.id)+'" '+(l.visible!==false?'checked':'')+'> '+esc(l.name)+'</label>'+(l.maskMissing?'<p>İndeks kaldırıldı. Yeni sınır seçip katmanı yeniden açın.</p>':'')+(l.kind==='raster'?'<label>Saydamlık<input type="range" min="0" max="1" step="0.05" value="'+(l.opacity??.8)+'" data-layer-opacity="'+l.id+'"></label><label><input type="checkbox" data-layer-clip="'+l.id+'" '+(l.clip?'checked':'')+'> İndeks sınırına göre göster</label><select data-layer-mask="'+l.id+'"><option value="">İndeks poligonu seçin</option>'+masks.map(m=>'<option value="'+m.id+'" '+(m.id===l.maskId?'selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select>':'')+'<div class="actions">'+buttons([['layer-zoom','Yaklaş',l.id],...(l.kind==='vector'||l.kind==='index'?[['layer-style','Renk / çizim stili',l.id]]:[]),['layer-front','Üste al',l.id],['layer-delete','Kaldır',l.id]])+'</div></div>').join('')}
function drawMeasure(){measureLayer.clearLayers();if(!measurement.length)return;measurement.forEach(p=>L.circleMarker([p[1],p[0]],{radius:4}).addTo(measureLayer));if(measurement.length<2)return;const line=L.polyline(measurement.map(p=>[p[1],p[0]]),{color:'#d9762f'}).addTo(measureLayer);let label=turf.length(turf.lineString(measurement),{units:'kilometers'}).toFixed(3)+' km';if(measureMode==='area'&&measurement.length>=3){L.polygon(measurement.map(p=>[p[1],p[0]]),{color:'#d9762f'}).addTo(measureLayer);label=(turf.area(turf.polygon([[...measurement,measurement[0]]]))/10000).toFixed(3)+' ha'}$('mapInfo').textContent='Yaklaşık ölçüm: '+label+' · Yeni köşe için haritaya tıklayın.'}
async function saveIndex(data,name){
 if(data.type!=='FeatureCollection'||!data.features?.length||data.features.some(f=>!['Polygon','MultiPolygon'].includes(f.geometry?.type)))throw Error('İndeks poligonlardan oluşmalı');
 await api('layer',{id:crypto.randomUUID(),kind:'index',name,data,visible:true});
}
async function matchPaftas(){await refresh();const masks=maskChoices();for(const l of state.layers.filter(l=>l.kind==='raster'&&!l.maskId)){const center=l.quad.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]),matches=masks.filter(m=>turf.booleanPointInPolygon(center,m.feature));if(matches.length===1)await api('layer',{...l,clip:true,maskId:matches[0].id})}await refresh()}
async function loadKMZ(files,asIndex=false){
 const maps=files.filter(f=>/\.(kml|kmz)$/i.test(f.name));if(!maps.length)throw Error('KML veya KMZ dosyasını seçin.');
 let count=0,indexCount=0,vectorCount=0;const warnings=[],outcomes=[];
 try{for(const f of maps){try{toast(f.name+' işleniyor…');const result=await readMapFile(f,files);warnings.push(...result.warnings);
 if(asIndex&&result.index){await saveIndex(result.index,f.name);indexCount++}
 // A mixed file used as an index is also retained intact as a vector layer.
 const mixed=result.vectors.features.some(f=>!['Polygon','MultiPolygon'].includes(f.geometry.type));
 if(result.vectors.features.length&&(!asIndex||mixed||!result.index)){await api('layer',{id:crypto.randomUUID(),kind:'vector',name:f.name,data:result.vectors,visible:true,color:'#267c9d'});vectorCount+=result.vectors.features.length}
 for(const item of result.items){await api('layer',{...item,id:crypto.randomUUID(),kind:'raster',opacity:.8,visible:true,clip:false,maskId:''});count++}
 outcomes.push(f.name+': Tamamlandı')}catch(e){outcomes.push(f.name+': Hata / kısmi aktarım — '+e.message)}}}finally{await matchPaftas()}
 const message=count+' pafta, '+indexCount+' indeks, '+vectorCount+' vektör öğesi eklendi.';toast(message);
 modal('İçe aktarma sonucu','<pre>'+esc(outcomes.join('\n'))+'</pre><p>'+esc(message)+'</p><p>'+warnings.length+' öğe desteklenen geometri içermediği için alınmadı:</p><pre>'+esc(warnings.slice(0,100).join('\n'))+'</pre>');
}
async function loadIndex(file){if(/\.(kml|kmz)$/i.test(file.name)){await loadKMZ([file],true);return}await saveIndex(JSON.parse(await file.text()),file.name);await matchPaftas();toast('İndeks yüklendi. Birden fazla aday olan paftalarda poligonu elle seçin.')}
let transferSummary={},transferMessage='Bağlantı kapalı.',transferIssues=[];
function summaryText(){return 'Eklenen: '+(transferSummary.added||0)+' · Aynı: '+(transferSummary.same||0)+' · Çakışma: '+(transferSummary.conflict||0)+' · Alınmayan: '+((transferSummary.trash||0)+(transferSummary['missing-parent']||0))+' · Hata: '+(transferSummary.error||0)}
function summary(result){transferSummary[result.status]=(transferSummary[result.status]||0)+1;const el=$('transferSummary');if(el)el.textContent=summaryText()}
async function receiveRecord(record){let result=await api('import',{record});if(result.status==='trash'&&confirm('“'+record.title+'” PC’de silinmiş. Yeniden alınsın mı?'))result=await api('import',{record,restore:true});if(result.status==='missing-parent')transferIssues.push(record.title+': Ana nokta eksik; önce ana noktayı, ardından bu ziyareti aktarın.');if(result.warning)transferIssues.push(record.title+': '+result.warning);summary(result);return result}
async function startQR(){
 receiver?.close();await api('lan-stop');transferSummary={};transferIssues=[];
 let localHtml='';
 try{
   const local=await api('lan-start');
   const codes=(local.invitations||[{url:local.url}]).slice(0,3);
   localHtml='<h3>1 · Aynı Wi-Fi / yerel ağ (önerilir)</h3><p>Bilgisayar ve telefon aynı Wi-Fi veya telefon erişim noktasında olmalı. İnternet gerekmez.</p>'+
     codes.map(entry=>{const qr=qrcode(0,'M');qr.addData(entry.url);qr.make();
       return '<div class="lan-qr"><img class="qr" src="'+qr.createDataURL(5,4)+'" alt="Yerel ağ QR">'+
         '<p><strong>'+esc(entry.interface||'LAN')+'</strong> · '+esc(entry.address||'')+'</p></div>'}).join('')+
     '<p class="notice">Telefonun AZiL uygulamasındaki QR Aktar ekranıyla okutun. Windows Güvenlik Duvarı sorarsa yalnızca özel ağlara izin verin. QR gizli oturum anahtarıdır, paylaşmayın.</p>';
 }catch(e){localHtml='<p class="notice">Yerel QR başlatılamadı: '+esc(e.message)+'. Wi-Fi/Ethernet bağlantısını kontrol edin.</p>'}
 receiver=startReceiver({onStatus:msg=>{if(!transferMessage.startsWith('Yerel')){transferMessage='İnternet: '+msg;const el=$('transferState');if(el)el.textContent=transferMessage}},onStart:async n=>{if(!Number.isInteger(n)||n<0||n>10000)throw Error('Kayıt sayısı geçersiz');await api('backup','before-import');transferSummary={};transferIssues=[];toast(n+' kayıt alınacak.')},onRecord:receiveRecord,onDone:async()=>{await refresh();toast(summaryText())}});
 const qr=qrcode(0,'M');qr.addData(receiver.url);qr.make();
 receiver.html=localHtml+'<details><summary>2 · İnternet / eski QR yöntemi (yedek)</summary><p>Bu yöntem WebRTC kullanır. Bazı modemlerde ve kurumsal ağlarda bağlantı kurulamayabilir.</p><img class="qr" src="'+qr.createDataURL(5,4)+'" alt="İnternet QR kodu"></details>';
 transferMessage='Yerel QR aktif. Telefonun QR Aktar ekranından ilk kodu okutun.';
 render();
}
function importChooser(data){if(data.app!=='Dijital Saha Defteri'||!Array.isArray(data.records)||data.records.length>10000)throw Error('Desteklenmeyen saha JSON yedeği');modal('Aktarılacak kayıtları seç','<label><input id="selectAll" type="checkbox" checked> Tüm kayıtlar</label><div id="importChoices">'+data.records.map((r,i)=>'<label><input type="checkbox" data-import-index="'+i+'" checked> '+esc(r.project)+' / '+esc(r.title)+' · '+(r.photos?.length||0)+' fotoğraf</label>').join('')+'</div><button id="doImport" class="primary">Seçilenleri PC’ye al</button>');$('selectAll').onchange=e=>$('importChoices').querySelectorAll('input').forEach(c=>c.checked=e.target.checked);$('doImport').onclick=guard(async()=>{const selected=[...$('importChoices').querySelectorAll('input:checked')].map(c=>data.records[Number(c.dataset.importIndex)]);if(!selected.length)throw Error('En az bir kayıt seçin');const button=$('doImport');button.disabled=true;try{await api('backup','before-import');transferSummary={};transferIssues=[];
 const source=new Map(data.records.map(r=>[r.id,r])),ordered=[],seen=new Set(),visiting=new Set();function add(r){if(seen.has(r.id))return;if(visiting.has(r.id))throw Error('Ziyaret bağlantısı döngü içeriyor');visiting.add(r.id);if(r.parentId&&source.has(r.parentId))add(source.get(r.parentId));visiting.delete(r.id);seen.add(r.id);ordered.push(r)}for(const r of selected)add(r);
 for(const r of ordered){try{await receiveRecord(r)}catch(e){summary({status:'error'});transferIssues.push((r.title||r.id)+': '+e.message)}}
 $('modal').close();await refresh();modal('JSON aktarım sonucu','<p>'+esc(summaryText())+'</p><p>Seçilen ziyaretlerin dosyada bulunan ana noktaları da aktarım kapsamına alındı. Hatalı kayıtlar düzeltilerek yeniden denenebilir.</p><pre>'+esc(transferIssues.join('\n'))+'</pre>');
 }finally{button.disabled=false}})}

const actions={
 'help-map':()=>openHelpCenter('guide','KML'),
 'help-data':()=>openHelpCenter('data'),
 'clear-filter':()=>{filter={q:'',project:'',type:'',from:'',to:''};render()},'repair-folders':async()=>{await api('repair-folders');await refresh();toast('Fotoğraf klasörleri arşivle eşitlendi.')},nav:go,close:closeModal,about,'archive-export':exportAtlas,'archive-import':importAtlas,folder:id=>api('open-folder',id),external:id=>api('external',id),
 project:()=>projectDialog(),
 'project-open':p=>{filter.project=p;go('records')},'project-new-point':p=>edit(null,p),
 'project-rename':p=>projectDialog(p),
 'project-trash':async p=>{const rs=state.records.filter(r=>r.project===p);if(confirm(p+' projesindeki '+rs.length+' nokta ve ziyaret Çöp Kutusuna taşınsın mı?')){await api('remove-project',p);await refresh()}},
 new:()=>edit(),edit:id=>edit(id),detail,visit:id=>{const r=state.records.find(r=>r.id===id);edit(null,r.project,r.parentId||r.id);$('recordForm').elements.title.value=r.title+' · Ziyaret';$('recordForm').elements.lat.value=r.lat??'';$('recordForm').elements.lon.value=r.lon??'';window.atlasDirty=true},
 'remove-photo':i=>{editPhotos.splice(Number(i),1);window.atlasDirty=true;renderEditPhotos()},photo:(_id,el)=>modal('Fotoğraf','<img style="max-width:100%;height:auto" src="'+esc(el.dataset.url)+'">'),
 'trash-record':async id=>{const r=state.records.find(r=>r.id===id),children=state.records.filter(x=>x.parentId===id);if(confirm(r.title+' ve '+children.length+' bağlı ziyareti Çöp Kutusuna taşınsın mı?')){await api('remove',[id,...children.map(x=>x.id)]);$('modal').close();await refresh()}},
 restore:async id=>{const t=state.trash.find(t=>t.id===id);if(t?.kind==='record'&&!confirm('Nokta ve bağlı ziyaretleri birlikte geri yüklensin mi?'))return;await api('restore',id);await refresh()},purge:async id=>{if(confirm('Bu öğe Çöp Kutusundan kalıcı olarak kaldırılsın mı? Yedek kopyaları saklanır.')){await api('purge',[id]);await refresh()}},'trash-empty':async()=>{if(confirm('Çöp Kutusundaki tüm öğeler kalıcı olarak kaldırılsın mı? Önce yedek alınacak.')){await api('purge',state.trash.map(t=>t.id));await refresh()}},
compare,
 'save-settings':async()=>{await api('settings',{theme:$('theme').value,font:Math.max(12,Math.min(22,Number($('fontSize').value)||15)),dense:$('dense').checked,photoMax:$('photoMax').value});await refresh()},
 'storage-info':async()=>{const el=$('storageSummary');if(!el)return;el.textContent='Arşiv hesaplanıyor…';const info=await api('storage');if(!$('storageSummary'))return;$('storageSummary').textContent='Varlıklar: '+info.assetsCount+' dosya / '+formatBytes(info.assetsBytes)+' · Arşiv JSON: '+formatBytes(info.archiveBytes)+' · JSON yedekleri: '+info.backupsCount},'save-key':async()=>{await api('settings',{esriKey:$('esriKey').value.trim()});toast('Yerel anahtar kaydedildi.');await refresh()},
 'qr-start':startQR,'qr-stop':async()=>{receiver?.close();receiver=null;await api('lan-stop');transferMessage='Bağlantı kapatıldı.';render()},json:()=>$('jsonFile').click(),
 pafta:()=>$('kmzFile').click(),index:()=>$('indexFile').click(),
 'layer-delete':async id=>{if(confirm('Katman kaldırılsın mı? Bu indeksle kırpılan paftalar, yeni indeks seçilene kadar gizlenecek. Önceki yedekler korunur.')){await api('layer',{id,remove:true});await refresh()}},'layer-front':async id=>{await api('layer',{...state.layers.find(l=>l.id===id),front:true});await refresh()},
 'layer-style':id=>openLayerStyleEditor(id),
 'layer-style-reset':async id=>{
  const l=state.layers.find(layer=>layer.id===id);
  if(!l)return;
  const {style,...rest}=l;
  await api('layer',rest);
  $('modal').close();
  await refresh();
  toast('Varsayılan katman renkleri geri geldi.');
 },
 'layer-zoom':id=>{const l=state.layers.find(l=>l.id===id);if(l.quad)map.fitBounds(l.quad.map(([lon,lat])=>[lat,lon]));else map.fitBounds(L.geoJSON(l.data).getBounds())},
 'map-return':()=>go('overview'),
 'map-sidebar':()=>toggleMapPanel('menu'),
 'map-tools':()=>toggleMapPanel('tools'),
 'map-fullscreen':async()=>{const full=await api('window-fullscreen');toast(full?'Pencere tam ekran: F11 ile çıkabilirsiniz.':'Pencere normal boyuta döndü.');updateMapWorkspace()},
 'toggle-layers':()=>toggleMapPanel('layers'),
 'toggle-detail':()=>toggleMapPanel('detail'),
 'measure-line':()=>{measureMode='line';measurement=[];drawMeasure();toast('Haritada sırayla noktaları işaretleyin.')},'measure-area':()=>{measureMode='area';measurement=[];drawMeasure();toast('Alan sınırının köşelerini işaretleyin.')},'measure-clear':()=>{measureMode=null;measurement=[];measureLayer.clearLayers()},
 'map-point':id=>{const r=state.records.find(r=>r.id===id);if(r.lat==null)throw Error('Noktanın koordinatı yok');filter={q:'',project:'',type:'',from:'',to:''};go('map');map.setView([r.lat,r.lon],16)},
 google:()=>{const c=map.getCenter();return api('external','https://www.google.com/maps/@'+c.lat+','+c.lng+',500m/data=!3m1!1e3')},yandex:()=>{const c=map.getCenter();return api('external','https://yandex.com/maps/?ll='+c.lng+'%2C'+c.lat+'&z='+map.getZoom()+'&l=sat')},
 reference:async()=>{for(const [file,name,color] of [['asi-turkiye.geojson','Asi Havzası · Türkiye','#85629d'],['asi-akarsular.geojson','Asi akarsuları','#287fb0']]){if(state.layers.some(l=>l.reference===file))continue;const data=await (await fetch('./data/'+file)).json();await api('layer',{id:crypto.randomUUID(),kind:'vector',name,reference:file,data,color,visible:true})}await refresh();toast('Hazır katmanlar eklendi. Kaynak: SYGM / OSM, 07.10.2026; güncel resmî envanter değildir.')},
 pdf:async()=>{await Promise.all([...document.querySelectorAll('#report img')].map(i=>i.decode().catch(()=>{})));return api('pdf')},'export-json':()=>exportData('json'),'export-csv':()=>exportData('csv'),'export-kml':()=>exportData('kml'),'export-geo':()=>exportData('geo')};
document.addEventListener('click',guard(async e=>{const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();await actions[b.dataset.action]?.(b.dataset.id,b)}));
document.addEventListener('change',guard(async e=>{const el=e.target;for(const [attr,key] of [['layerVisible','visible'],['layerOpacity','opacity'],['layerClip','clip'],['layerMask','maskId']])if(el.dataset[attr]){const l=state.layers.find(l=>l.id===el.dataset[attr]);const value=el.type==='checkbox'?el.checked:key==='opacity'?Number(el.value):el.value;if(key==='clip'&&value&&!l.maskId){el.checked=false;throw Error('Önce indeks poligonunu seçin')}await api('layer',{...l,[key]:value,...(key==='maskId'&&value?{maskMissing:false,clip:true}:{} )});await refresh();return}if(['projectFilter','typeFilter','from','to'].includes(el.id)){filter[el.id==='projectFilter'?'project':el.id==='typeFilter'?'type':el.id]=el.value;render()}}));
document.addEventListener('input',e=>{if(e.target.id==='search'){filter.q=e.target.value;const pos=e.target.selectionStart;clearTimeout(window.searchTimer);window.searchTimer=setTimeout(()=>{render();$('search')?.focus();$('search')?.setSelectionRange(pos,pos)},250)}});
$('jsonFile').onchange=guard(async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>300*1024*1024)throw Error('JSON en fazla 300 MB');importChooser(JSON.parse(await f.text()))}finally{e.target.value=''}});
$('kmzFile').onchange=guard(async e=>{try{await loadKMZ([...e.target.files])}finally{e.target.value=''}});$('indexFile').onchange=guard(async e=>{try{if(e.target.files[0])await loadIndex(e.target.files[0])}finally{e.target.value=''}});
$('newPoint').onclick=guard(()=>edit());$('quickImport').onclick=guard(()=>go('transfer'));$('quickBackup').onclick=guard(exportAtlas);$('profile').onclick=guard(about);$('modal').addEventListener('cancel',e=>{if(window.atlasDirty){e.preventDefault();closeModal()}});
window.desktop.onLan(event=>{
 if(!event||typeof event!=='object')return;
 if(event.kind==='status'){
   transferMessage=event.status||'Yerel ağ aktarımı';const el=$('transferState');if(el)el.textContent=transferMessage;
 }else if(event.kind==='begin'){
   transferSummary={};transferIssues=[];const el=$('transferSummary');if(el)el.textContent='Yerel aktarım başladı: '+event.count+' kayıt.';
 }else if(event.kind==='receipt'){
   summary({status:event.status||'unknown'});
   if(event.warning)transferIssues.push(String(event.warning).slice(0,180));
 }else if(event.kind==='done'){
   refresh().then(()=>toast('Yerel aktarım tamamlandı: '+event.received+' kayıt.')).catch(e=>toast(e.message));
 }
});
window.desktop.onMenu(guard(async c=>{if(c==='project')await actions.project();else if(c==='new')edit();else if(c==='archive-export')await exportAtlas();else if(c==='about')about();else if(c.startsWith('help:'))await openHelpCenter(c.slice(5));else go(c)}));
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape'||view!=='map'||$('modal').open)return;
 for(const key of ['menu','tools','layers','detail']){
  if(mapPanels[key]){mapPanels[key]=false;updateMapWorkspace();e.preventDefault();break}
 }
});
window.addEventListener('beforeunload',()=>{receiver?.close();api('lan-stop').catch(()=>{})});
await refresh();
window.__atlasStartupReady=true;
