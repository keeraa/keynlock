// The Three.js runtime is included in our local application bundle.
// Report startup and WebGL errors without blaming remote dependencies.
  function reportStartupError(reason){
    if(document.getElementById('loading').classList.contains('done'))return;
    document.getElementById('errorReason').textContent=String(reason||'Браузер не смог инициализировать WebGL.').slice(0,200);
    document.getElementById('loading').style.display='none';
    document.getElementById('fallback').style.display='grid';
  }
  window.addEventListener('error',e=>reportStartupError(e.message));
  window.addEventListener('unhandledrejection',e=>reportStartupError(e.reason?.message||e.reason));
  setTimeout(()=>{
    if(!document.getElementById('loading').classList.contains('done')){
      reportStartupError('Превышено время запуска. Проверь поддержку WebGL в браузере.');
    }
  },15000);
