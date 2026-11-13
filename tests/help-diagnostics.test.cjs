'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {diagnosticSnapshot,formatDiagnostics,archiveHealth}=
  require('../desktop-source/app/electron/help-diagnostics.cjs');
async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'azil-help-'));
 try{
  const known='a'.repeat(64)+'.jpg',missing='b'.repeat(64)+'.png';
  await fs.writeFile(path.join(temp,known),Buffer.from('mock'));
  const store={
   lastWarning:'PRIVATE_NOTE coordinate 36.30,36.35; C:\\Private\\Archive',
   state:{
    settings:{esriKey:'PRIVATE_SECRET'},
    projects:['PRIVATE_PROJECT_NAME'],
    records:[
      {id:'p1',title:'PRIVATE_RECORD',note:'PRIVATE_NOTE',lat:36.3,lon:36.35,
       photos:[{ref:known}]},
      {id:'v1',parentId:'gone',photos:[{ref:missing}]}
    ],
    layers:[{id:'x',ref:known}]
   },
   assetFile:ref=>{
    if(!/^[a-f0-9]{64}\.(jpg|png)$/.test(ref))throw Error('Invalid file ref');
    return path.join(temp,ref);
   }
  };
  const info=diagnosticSnapshot(store,{version:'1.1.0-beta.4',platform:'win32',arch:'x64',electron:'34.0'});
  const output=formatDiagnostics(info);
  for(const sensitive of ['PRIVATE_SECRET','PRIVATE_NOTE','PRIVATE_PROJECT_NAME','PRIVATE_RECORD','C:\\Private\\Archive','36.3','36.35'])
    assert.ok(!output.includes(sensitive),'Diagnostics leaked sensitive content');
  assert.equal(info.recordCount,2);
  assert.equal(info.visitCount,1);
  assert.equal(info.warningPresent,true);
  assert.equal(info.cloudSync,false);
  const audit=await archiveHealth(store);
  assert.equal(audit.assets,2);
  assert.equal(audit.missingAssets,1);
  assert.equal(audit.missingParents,1);
  assert.equal(audit.records,2);
  assert.deepEqual(await fs.readFile(path.join(temp,known)),Buffer.from('mock'));
  console.log('PASS: redacted diagnostics, non-mutating archive health and missing-file checks');
 }finally{await fs.rm(temp,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1});
