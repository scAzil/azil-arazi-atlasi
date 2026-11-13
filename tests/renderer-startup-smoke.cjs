'use strict';
const {chromium}=require('playwright-core');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_app/app');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
  const full=path.resolve(root,relative);
  if(!full.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  const data=await fs.readFile(full);
  res.setHeader('Content-Type',mime[path.extname(full)]||'application/octet-stream');
  res.end(data);
 }catch(e){console.error('RESOURCE_404',req.url,e.code||e.message);res.writeHead(404);res.end('missing')}
});
async function test(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu','--no-sandbox']});
 try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message||String(e))+' / '+JSON.stringify({name:e.name,message:e.message})));
  page.on('response',resp=>{if(resp.status()>=400)console.error('HTTP_FAILURE',resp.status(),resp.url())});
  page.on('requestfailed',req=>console.error('REQUEST_FAILED',req.url(),req.failure()?.errorText));
  page.on('console',msg=>{if(msg.type()==='error')errors.push('console error: '+msg.text())});
  await page.addInitScript(()=>{
   window.desktop={
    call:async(command)=>{
     if(command==='state')return {
      version:'1.1.0-beta.2',archivePath:'C:\\Atlas\\Arsiv',backupPath:'C:\\Atlas\\Yedekler',
      settings:{theme:'light',font:15,dense:false,basemap:'osm',photoMax:'original'},
      projects:[],records:[],trash:[],layers:[],history:[],lastBackup:null,warning:null
     };
     return null;
    },
    onMenu:()=>{}
   };
  });
  await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'load'});
  await page.waitForTimeout(1500);
  const result=await page.evaluate(()=>({
   nav:document.querySelectorAll('#nav button').length,
   title:document.querySelector('#title')?.textContent,
   status:document.querySelector('#status')?.textContent,
   content:document.querySelector('#content')?.textContent?.slice(0,200),
   scripts:[...document.scripts].map(s=>s.src)
  }));
  console.log('RENDERER_STARTUP_RESULT',JSON.stringify(result));
  console.log('RENDERER_STARTUP_ERRORS',JSON.stringify(errors));
  assert.equal(errors.length,0,errors.join('\n'));
  assert.ok(result.nav>=5,'Nav must be rendered: '+JSON.stringify(result));
  assert.notEqual(result.status,'Arşiv açılıyor…');
  console.log('PASS: renderer mounted navigation and loaded archive state');
 }finally{await browser.close();server.close()}
}
test().catch(e=>{console.error(e);process.exitCode=1;server.close()});
