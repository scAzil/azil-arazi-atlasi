'use strict';
// Offline startup diagnostics. Never sends user data outside the application.
(()=>{
  const show=message=>{
    if(window.__atlasStartupReady)return;
    const el=document.getElementById('status');
    if(!el)return;
    const detail=String(message||'Bilinmeyen hata').slice(0,350);
    el.textContent='Arayüz açılamadı: '+detail+' · Yardım → Hata inceleme';
    el.style.color='#a3332c';
    el.style.fontWeight='600';
  };
  window.addEventListener('error',event=>{
    if(event.target&&event.target!==window)return;
    const where=event.filename?event.filename.split('/').pop()+':'+event.lineno:'';
    show([event.message,where].filter(Boolean).join(' · '));
  });
  window.addEventListener('unhandledrejection',event=>{
    show(event.reason?.message||String(event.reason||'Beklenmedik hata'));
  });
  window.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{
      if(!window.__atlasStartupReady)show('Başlangıç tamamlanamadı; program verilerini silmeyin.');
    },8000);
  });
})();
