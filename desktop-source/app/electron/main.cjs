'use strict';
const {app,BrowserWindow,protocol,ipcMain,dialog,shell,Menu,clipboard}=require('electron'),fs=require('node:fs/promises'),path=require('node:path');
const {Store}=require('./store.cjs');
const {exportPortable,importPortable}=require('./portable-archive.cjs');
const {diagnosticSnapshot,formatDiagnostics,archiveHealth}=require('./help-diagnostics.cjs');
const root=app.isPackaged?path.dirname(process.execPath):path.resolve(__dirname,'..');
const legacy=path.join(app.getPath('appData'),'AZiL-Arazi-Atlasi');
app.setPath('userData',path.join(root,'Arsiv','.Profil'));
protocol.registerSchemesAsPrivileged([{scheme:'atlas',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let win,store,closing=false;
if(!app.requestSingleInstanceLock())app.quit();else{
app.on('second-instance',()=>{if(win){win.restore();win.focus()}});
app.whenReady().then(async()=>{
store=await new Store(root).init();
protocol.handle('atlas',async request=>{try{const u=new URL(request.url);if(u.hostname!=='app')return new Response('',{status:404});const rel=decodeURIComponent(u.pathname).replace(/^\/+/,''),base=path.join(__dirname,'../app');let f;if(rel.startsWith('asset/'))f=store.assetFile(rel.slice(6));else{f=path.resolve(base,rel||'index.html');if(!f.startsWith(base+path.sep))return new Response('',{status:404})}const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.geojson':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};return new Response(await fs.readFile(f),{headers:{'Content-Type':types[path.extname(f)]||'application/octet-stream'}})}catch{return new Response('Dosya yok',{status:404})}});
const diagnostic=()=>diagnosticSnapshot(store,{
 version:app.getVersion(),
 platform:process.platform,
 arch:process.arch,
 electron:process.versions.electron
});
const handlers={
 'help-diagnostics':()=>diagnostic(),
 'help-copy-diagnostics':()=>{
   clipboard.writeText(formatDiagnostics(diagnostic()));
   return true;
 },
 'help-archive-health':()=>archiveHealth(store),
 'help-open-backups':()=>shell.openPath(store.backups),
 'state':async()=>({...store.state,warning:store.lastWarning,archivePath:store.dir,backupPath:store.backups,version:app.getVersion()}),
 'window-fullscreen':()=>{win.setFullScreen(!win.isFullScreen());return win.isFullScreen()},
 'storage':async()=>{
   const files=await fs.readdir(store.assets);
   let bytes=0, count=0;
   for(const name of files){
     if(!/^[a-f0-9]{64}\.(jpg|png|webp|json|kmz|kml)$/.test(name))continue;
     try{const st=await fs.stat(path.join(store.assets,name));if(st.isFile()){bytes+=st.size;count++}}catch{}
   }
   const archive=(await fs.stat(store.file)).size;
   const backups=(await fs.readdir(store.backups)).filter(name=>name.endsWith('.json'));
   return {assetsCount:count,assetsBytes:bytes,archiveBytes:archive,backupsCount:backups.length};
 },
 'repair-folders':()=>store.repairMirrors(),'save':r=>store.save(r),'import':({record,restore})=>store.importRecord(record,restore),'remove':ids=>store.remove(ids),'remove-project':name=>store.remove(store.state.records.filter(r=>r.project===name).map(r=>r.id),name),'restore':id=>store.restore(id),'purge':ids=>store.purge(ids),'history':id=>store.historyRestore(id),'settings':v=>store.settings(v),'project':({name,newName})=>store.project(name,newName),'layer':v=>store.layer(v),
 'archive-export':async()=>{
   const suggested='AZiL-Atlas-'+new Date().toISOString().slice(0,10)+'.atlas.zip';
   const r=await dialog.showSaveDialog(win,{
      title:'AZiL Atlas arşivini dışa aktar (güncel kayıtlar)',
      defaultPath:suggested,filters:[{name:'AZiL Atlas taşınabilir arşiv',extensions:['zip']}]});
   if(r.canceled)return null;
   return exportPortable(store,r.filePath,app.getVersion());
 },
 'archive-import':async()=>{
   const r=await dialog.showOpenDialog(win,{
     title:'AZiL Atlas taşınabilir arşiv dosyasını seçin',
     properties:['openFile'],
     filters:[{name:'AZiL Atlas arşiv (*.atlas.zip)',extensions:['zip']}]});
   if(r.canceled)return null;
   const choice=await dialog.showMessageBox(win,{
     type:'question',
     title:'Güncel arşiv dosyasını içe aktar',
     message:'Arşivdeki güncel noktalar, ziyaretler, katmanlar ve fotoğraflar içe aktarılsın mı?',
     detail:'Mevcut kayıtlar silinmez veya üzerine yazılmaz. Aynı kimlikle farklı içerik varsa işlem durdurulur. Bu işlem eski tarihli yedek sürümüne dönmek değildir.',
     buttons:['Vazgeç','İçe aktar'],defaultId:0,cancelId:0,noLink:true
   });
   if(choice.response!==1)return null;
   return importPortable(store,r.filePaths[0]);
 },
 'backup':reason=>store.run(()=>store.backup(['manual','before-import'].includes(reason)?reason:'manual')),
 'open-folder':async recordId=>{let dir=store.dir;if(recordId){const r=store.state.records.find(r=>r.id===recordId);if(!r)throw Error('Nokta yok');dir=store.recordDir(r)}return shell.openPath(dir)},
 'external':async url=>{const u=new URL(url);if(u.protocol!=='https:'||!['sbncifci.tr.gg','books.google.com','play.google.com','www.google.com','yandex.com','yandex.com.tr','developers.google.com','developers.arcgis.com'].includes(u.hostname))throw Error('Bağlantıya izin verilmedi');return shell.openExternal(u.href)},
 'export':async({name,text})=>{if(typeof text!=='string'||text.length>350*1024*1024)throw Error('Dosya çok büyük');const r=await dialog.showSaveDialog(win,{defaultPath:path.basename(name)});if(r.canceled)return false;await fs.writeFile(r.filePath,text,'utf8');return true},
 'pdf':async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'Saha-Raporu.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,await win.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true}));return true}
};
for(const [name,fn] of Object.entries(handlers))ipcMain.handle('atlas:'+name,(e,arg)=>{if(e.sender!==win?.webContents||!e.senderFrame?.url.startsWith('atlas://app/'))throw Error('Geçersiz kaynak');return fn(arg)});
win=new BrowserWindow({width:1450,height:920,minWidth:980,minHeight:650,icon:path.join(__dirname,'../app/icon.png'),title:'Arazi Atlası',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('atlas://app/'))e.preventDefault()});win.webContents.session.setPermissionRequestHandler((w,p,cb)=>cb(false));
const cmd=c=>()=>win.webContents.send('atlas:menu',c);
Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Dosya',submenu:[{label:'Yeni proje',accelerator:'Ctrl+Shift+N',click:cmd('project')},{label:'Yeni nokta',accelerator:'Ctrl+N',click:cmd('new')},{label:'Telefondan aktar',click:cmd('transfer')},{label:'Arşivi dışa aktar',accelerator:'Ctrl+Shift+S',click:cmd('archive-export')},{type:'separator'},{label:'Çıkış',role:'quit'}]},{label:'Düzenle',submenu:[{label:'Geri al',role:'undo'},{label:'Yinele',role:'redo'},{type:'separator'},{label:'Kes',role:'cut'},{label:'Kopyala',role:'copy'},{label:'Yapıştır',role:'paste'},{label:'Tümünü seç',role:'selectAll'}]},{label:'Görünüm',submenu:[{label:'Yakınlaştır',role:'zoomIn'},{label:'Uzaklaştır',role:'zoomOut'},{label:'Gerçek boyut',role:'resetZoom'},{label:'Tam ekran',role:'togglefullscreen'},{label:'Tema ve görünüm',click:cmd('settings')}]},{label:'Araçlar',submenu:[{label:'Harita ve paftalar',click:cmd('map')},{label:'Raporlar',click:cmd('reports')},{label:'Çöp Kutusu',click:cmd('trash')}]},{label:'Yardım',submenu:[
 {label:'Yardım Merkezi',accelerator:'F1',click:cmd('help:guide')},
 {type:'separator'},
 {label:'Program Hakkında',click:cmd('help:about')},
 {label:'Kullanım Kılavuzu',click:cmd('help:guide')},
 {label:'Sürüm Notları',click:cmd('help:notes')},
 {label:'Sorun Giderme',click:cmd('help:troubleshoot')},
 {label:'Verilerim Nerede?',click:cmd('help:data')},
 {label:'Tanılama Bilgileri',click:cmd('help:diagnostics')},
 {label:'Klavye Kısayolları',click:cmd('help:shortcuts')},
 {type:'separator'},
 {label:'Arşiv klasörünü aç',click:()=>shell.openPath(store.dir)},
 {label:'Geliştirici araçları',role:'toggleDevTools'}
]}]));
win.on('close',e=>{if(closing)return;e.preventDefault();win.webContents.executeJavaScript('Boolean(window.atlasDirty)').then(async dirty=>{if(dirty&&(await dialog.showMessageBox(win,{type:'question',buttons:['Düzenlemeye dön','Kaydetmeden kapat'],defaultId:0,cancelId:0,message:'Kaydedilmemiş değişiklikler var.'})).response===0)return;await store.queue;closing=true;win.close()}).catch(()=>{closing=true;win.close()})});
await win.loadURL('atlas://app/index.html');
}).catch(e=>{dialog.showErrorBox('Arşiv açılamadı',e.message+'\nProgramı yazılabilir bir klasöre taşıyın. Arşiv başka konuma taşınmadı.');app.quit()});
app.on('window-all-closed',()=>app.quit());}
