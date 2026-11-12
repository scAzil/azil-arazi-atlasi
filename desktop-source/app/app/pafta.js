export function xml(content){
 if(content?.nodeType===9)return content;
 let source=String(content).replace(/^\uFEFF/,'').trim();
 if(!source.startsWith('<'))throw Error('KML metni bekleniyor. Sıkıştırılmış KMZ dosyasının uzantısını KML olarak değiştirmeyin.');
 const parse=s=>new DOMParser().parseFromString(s,'application/xml'),error=d=>d.getElementsByTagNameNS('*','parsererror')[0];
 let d=parse(source);
 // Some GIS exports use xsi:schemaLocation without declaring xsi.
 // Repair only that known namespace, in memory; never rewrite the user's file.
 if(error(d)&&/\bxsi:/.test(source)){
  const root=/^(\s*(?:(?:<\?[\s\S]*?\?>|<!--[\s\S]*?-->)\s*)*)<((?:[\w.-]+:)?kml)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/;
  source=source.replace(root,(whole,pre,name,attrs)=>/\bxmlns:xsi\s*=/.test(attrs)?whole:pre+'<'+name+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'+attrs+'>');
  d=parse(source);
 }
 const err=error(d);if(err)throw Error('KML XML yapısı okunamadı: '+err.textContent.replace(/\s+/g,' ').slice(0,220));
 if(d.documentElement.localName.toLowerCase()!=='kml')throw Error('Dosya KML değil; kök etiket: '+d.documentElement.localName);
 return d;
}
const all=(d,n)=>Array.from(d.getElementsByTagNameNS('*',n)),text=(d,n)=>all(d,n)[0]?.textContent?.trim()||'';
function coords(t){return t.trim().split(/\s+/).filter(Boolean).map(s=>s.split(',').slice(0,2).map(Number))}
const children=(d,n)=>Array.from(d.children||[]).filter(x=>x.localName===n),childText=(d,n)=>children(d,n)[0]?.textContent?.trim()||'';
function positions(value,min){
 const result=value.trim().split(/\s+/).filter(Boolean).map(token=>{const parts=token.split(',');if(parts.length<2||!parts[0]||!parts[1])throw Error('KML koordinatı eksik');const p=parts.slice(0,3).map(Number);if(p.some(x=>!Number.isFinite(x))||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('KML koordinatı geçersiz');return p});
 if(result.length<min)throw Error('KML geometrisinde yeterli koordinat yok');return result;
}
function geometry(node){
 const type=node.localName;
 if(type==='Point'){const p=positions(childText(node,'coordinates'),1);if(p.length!==1)throw Error('KML noktası tek koordinat içermeli');return {type:'Point',coordinates:p[0]}}
 if(type==='LineString'||type==='LinearRing')return {type:'LineString',coordinates:positions(childText(node,'coordinates'),2)};
 if(type==='Polygon'){
  const outer=children(node,'outerBoundaryIs')[0];if(!outer)throw Error('Poligon dış sınırı yok');
  const rings=[outer,...children(node,'innerBoundaryIs')].map(boundary=>{const ring=children(boundary,'LinearRing')[0];if(!ring)throw Error('Poligon sınırı yok');const ps=positions(childText(ring,'coordinates'),3);if(ps[0].join()!==ps.at(-1).join())ps.push([...ps[0]]);return ps});
  return {type:'Polygon',coordinates:rings};
 }
 if(type==='MultiGeometry')return combine(Array.from(node.children).map(geometry).filter(Boolean));
 return null;
}
function combine(gs){if(!gs.length)return null;if(gs.length===1)return gs[0];const type=gs[0].type;if(['Point','LineString','Polygon'].includes(type)&&gs.every(g=>g.type===type))return {type:'Multi'+type,coordinates:gs.map(g=>g.coordinates)};return {type:'GeometryCollection',geometries:gs}}
export function kmlVectors(content){
 const d=xml(content),features=[],warnings=[];
 for(const [i,pm] of all(d,'Placemark').entries()){
  const name=childText(pm,'name')||'Öğe '+(i+1),g=combine(Array.from(pm.children).map(geometry).filter(Boolean));
  if(!g){warnings.push(name+': desteklenen nokta/çizgi/poligon geometrisi yok');continue}
  const properties={name,description:childText(pm,'description')};
  const folder=[];for(let parent=pm.parentElement;parent;parent=parent.parentElement)if(parent.localName==='Folder')folder.unshift(childText(parent,'name'));if(folder.length)properties.folder=folder.join(' / ');
  const attributes=Object.create(null);for(const data of all(pm,'Data')){const key=data.getAttribute('name');if(key)attributes[key]=text(data,'value')}for(const data of all(pm,'SimpleData')){const key=data.getAttribute('name');if(key)attributes[key]=data.textContent.trim()}if(Object.keys(attributes).length)properties.attributes=attributes;
  features.push({type:'Feature',...(pm.getAttribute('id')?{id:pm.getAttribute('id')}:{}),properties,geometry:g});
 }
 return {data:{type:'FeatureCollection',features},warnings};
}
export function polygonFeatures(data){
 const out=[];function polys(g){if(g.type==='Polygon')return [g.coordinates];if(g.type==='MultiPolygon')return g.coordinates;if(g.type==='GeometryCollection')return g.geometries.flatMap(polys);return []}
 for(const f of data.features){const ps=polys(f.geometry);if(ps.length)out.push({...f,geometry:ps.length===1?{type:'Polygon',coordinates:ps[0]}:{type:'MultiPolygon',coordinates:ps}})}return {type:'FeatureCollection',features:out};
}
export function kmlIndex(content){const data=polygonFeatures(kmlVectors(content).data);if(!data.features.length)throw Error('KML içinde poligon bulunamadı');return data}
export function groundOverlays(kml){const d=xml(kml);return all(d,'GroundOverlay').map(o=>{const href=text(all(o,'Icon')[0]||o,'href'),q=all(o,'LatLonQuad')[0];let quad;if(q){quad=coords(text(q,'coordinates'));if(quad.length!==4)throw Error('KMZ dört köşe koordinatı geçersiz')}else{const box=all(o,'LatLonBox')[0];if(!box)throw Error('KMZ görüntüsünün koordinatları yok');const n=Number(text(box,'north')),s=Number(text(box,'south')),e=Number(text(box,'east')),w=Number(text(box,'west'));if(!(n>s&&e>w))throw Error('KMZ sınırları geçersiz veya tarih çizgisini aşıyor');quad=[[w,s],[e,s],[e,n],[w,n]];const a=Number(text(box,'rotation')||0)*Math.PI/180;if(a){const cx=(w+e)/2,cy=(s+n)/2,c=Math.cos(cy*Math.PI/180);quad=quad.map(([x,y])=>{const dx=(x-cx)*c,dy=y-cy;return [cx+(dx*Math.cos(a)-dy*Math.sin(a))/c,cy+dx*Math.sin(a)+dy*Math.cos(a)]})}}if(quad.some(p=>!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('KMZ koordinatları geçersiz');return {name:text(o,'name')||'Pafta',href,quad}})}
// Decode XML bytes before parsing: File.text() always assumes UTF-8.
export function decodeKML(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(b[0]===0xff&&b[1]===0xfe)return new TextDecoder('utf-16le').decode(b);
 if(b[0]===0xfe&&b[1]===0xff)return new TextDecoder('utf-16be').decode(b);
 if(b[0]===60&&b[1]===0)return new TextDecoder('utf-16le').decode(b);
 if(b[0]===0&&b[1]===60)return new TextDecoder('utf-16be').decode(b);
 const head=new TextDecoder('ascii').decode(b.slice(0,256)),decl=/encoding\s*=\s*['"]([^'"]+)['"]/i.exec(head);
 try{return new TextDecoder(decl?.[1]||'utf-8',{fatal:true}).decode(b)}catch(e){throw Error('KML metin kodlaması okunamadı. Dosyayı UTF-8 KML olarak dışa aktarın.')}
}
function relativePath(base,href){
 let value;try{value=decodeURIComponent(href)}catch{throw Error('KML görüntü yolu geçersiz: '+href)}
 if(/^([a-z]+:|\/|\\)/i.test(value))throw Error('KML harici dosyaya bağlı: '+href+'. Görüntüleri içeren KMZ olarak kaydedin.');
 const stack=base.split('/').slice(0,-1);for(const part of value.replace(/\\/g,'/').split('/')){if(part==='..'){if(!stack.length)throw Error('KML dosya yolu arşiv dışına çıkıyor');stack.pop()}else if(part&&part!=='.')stack.push(part)}return stack.join('/');
}
function findFile(files,target,loose=false){
 if(files[target])return target;
 let matches=Object.keys(files).filter(k=>k.toLowerCase()===target.toLowerCase());
 if(!matches.length&&loose)matches=Object.keys(files).filter(k=>k.split('/').pop().toLowerCase()===target.split('/').pop().toLowerCase());
 if(matches.length===1)return matches[0];
 if(matches.length>1)throw Error('Aynı adlı birden fazla görüntü var: '+target+'. KMZ olarak yükleyin.');
 return null;
}
export async function readMapFile(file,companions=[]){
 if(file.size>200*1024*1024)throw Error('Tek KML/KMZ en fazla 200 MB olabilir.');
 const bytes=new Uint8Array(await file.arrayBuffer()),isZip=bytes[0]===0x50&&bytes[1]===0x4b;let files={},names=[],total=0;
 if(isZip){
  try{files=fflate.unzipSync(bytes,{filter:f=>{total+=f.originalSize;if(total>400*1024*1024)throw Error('Açılmış KMZ toplamı 400 MB sınırını aşıyor');return /\.(kml|png|jpe?g|webp)$/i.test(f.name)}})}catch(e){throw Error('KMZ açılamadı: '+e.message)}
  names=Object.keys(files).filter(k=>/\.kml$/i.test(k)&&!k.startsWith('__MACOSX/'));
  if(!names.length)throw Error('KMZ içinde KML dosyası bulunamadı.');
 }else{
  files[file.name]=bytes;names=[file.name];
  for(const side of companions){if(side===file||! /\.(png|jpe?g|webp)$/i.test(side.name))continue;if(side.size>200*1024*1024)throw Error('Pafta görüntüsü en fazla 200 MB olabilir.');total+=side.size;if(total>400*1024*1024)throw Error('Seçilen görüntüler toplamı 400 MB sınırını aşıyor');if(files[side.name])throw Error('Aynı adlı görüntüler birlikte seçilemez.');files[side.name]=new Uint8Array(await side.arrayBuffer())}
 }
 const features=[],items=[],docs=[],seen=new Set(),warnings=[];
 for(const name of names){let d;try{d=xml(decodeKML(files[name]))}catch(e){throw Error(name+': '+e.message)}docs.push({name,d});const parsed=kmlVectors(d);features.push(...parsed.data.features);warnings.push(...parsed.warnings.map(w=>name+': '+w))}
 for(const {name,d} of docs)for(const o of groundOverlays(d)){
  const target=relativePath(name,o.href),key=findFile(files,target,!isZip);
  if(!key)throw Error('Pafta görüntüsü bulunamadı: '+o.href+'. KML kullanıyorsanız KML ile PNG/JPG dosyalarını birlikte seçin veya görüntüleri içeren KMZ yükleyin.');
  if(!/\.(png|jpe?g|webp)$/i.test(key))throw Error('Pafta görüntüsü PNG, JPG veya WebP olmalı: '+key);
  if(files[key].byteLength>200*1024*1024)throw Error('KMZ içindeki pafta görüntüsü 200 MB sınırını aşıyor.');
  const signature=key+'|'+JSON.stringify(o.quad);if(seen.has(signature))continue;seen.add(signature);
  const ext=key.split('.').pop().toLowerCase(),mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Görüntü okunamadı: '+key));r.readAsDataURL(new Blob([files[key]],{type:mime}))});
  items.push({...o,name:file.name.replace(/\.(kmz|kml)$/i,'')+' · '+o.name,dataUrl});
 }
 if(!items.length&&!features.length){const links=docs.flatMap(({d})=>all(d,'NetworkLink'));throw Error(links.length?'Dosyada yalnız bağlantı var; bağlı KML ve görüntüler arşivde bulunamadı. Görüntüleri içeren KMZ olarak kaydedin.':'Dosyada desteklenen nokta, çizgi, poligon veya koordinatlı pafta görüntüsü bulunamadı.')}
 const vectors={type:'FeatureCollection',features},index=polygonFeatures(vectors);return {items,vectors,index:index.features.length?index:null,warnings};
}
export async function readKMZ(file){const result=await readMapFile(file);if(!result.items.length)throw Error('Bu dosya pafta görüntüsü değil, poligon indeksidir. İndeks yükle bölümünü kullanın.');return result.items}
export function rasterLayer(item,mask){return new (L.Layer.extend({onAdd(map){this.map=map;this.canvas=L.DomUtil.create('canvas','leaflet-layer');this.canvas.style.pointerEvents='none';this.canvas.style.opacity=item.opacity??0.8;map.getPanes().overlayPane.append(this.canvas);this.img=new Image();this.img.onload=()=>this.draw();this.img.src='atlas://app/asset/'+item.ref;map.on('moveend zoomend resize',this.draw,this);this.draw()},onRemove(map){map.off('moveend zoomend resize',this.draw,this);this.canvas.remove();this.img.src=''},draw(){if(!this.img?.complete||!this.img.naturalWidth)return;const m=this.map,size=m.getSize(),c=this.canvas;c.width=size.x;c.height=size.y;L.DomUtil.setPosition(c,m.containerPointToLayerPoint([0,0]));const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.save();if(mask){ctx.beginPath();const polys=mask.geometry.type==='Polygon'?[mask.geometry.coordinates]:mask.geometry.coordinates;for(const poly of polys)for(const ring of poly){ring.forEach(([lon,lat],i)=>{const p=m.latLngToContainerPoint([lat,lon]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath()}ctx.clip('evenodd')}
const q=item.quad,point=(u,v)=>{const ll=[(1-u)*(1-v)*q[3][0]+u*(1-v)*q[2][0]+u*v*q[1][0]+(1-u)*v*q[0][0],(1-u)*(1-v)*q[3][1]+u*(1-v)*q[2][1]+u*v*q[1][1]+(1-u)*v*q[0][1]];return m.latLngToContainerPoint([ll[1],ll[0]])};
function tri(src,dst){const [a,b,c]=src,[p,q,r]=dst,den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(den)<1e-9)return;const coef=key=>[(p[key]*(b.y-c.y)+q[key]*(c.y-a.y)+r[key]*(a.y-b.y))/den,(p[key]*(c.x-b.x)+q[key]*(a.x-c.x)+r[key]*(b.x-a.x))/den,(p[key]*(b.x*c.y-c.x*b.y)+q[key]*(c.x*a.y-a.x*c.y)+r[key]*(a.x*b.y-b.x*a.y))/den];const x=coef('x'),y=coef('y');ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();ctx.setTransform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(this.img,0,0);ctx.restore()}
const steps=12;for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){const uv=[[x/steps,y/steps],[(x+1)/steps,y/steps],[(x+1)/steps,(y+1)/steps],[x/steps,(y+1)/steps]],src=uv.map(([u,v])=>({x:u*this.img.naturalWidth,y:v*this.img.naturalHeight})),dst=uv.map(([u,v])=>point(u,v));tri.call(this,[src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);tri.call(this,[src[0],src[2],src[3]],[dst[0],dst[2],dst[3]])}ctx.restore()}}))()}
