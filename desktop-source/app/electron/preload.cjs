const {contextBridge,ipcRenderer}=require('electron');
const names=['state','repair-folders','save','import','remove','remove-project','restore','purge','history','settings','project','layer','backup','backups','restore-backup','external-backup','external-restore','open-folder','legacy','external','export','pdf'];
contextBridge.exposeInMainWorld('desktop',{call:(name,arg)=>{if(!names.includes(name))throw Error('İşlem yok');return ipcRenderer.invoke('atlas:'+name,arg)},onMenu:fn=>ipcRenderer.on('atlas:menu',(_e,c)=>fn(c))});
