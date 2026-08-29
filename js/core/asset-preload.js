(function(){
  'use strict';
  // Preloads every image under assets/ (per the generated asset-manifest.json)
  // before the game boots. js/core/init.js awaits window.KeynlockAssetsReady
  // before running its final "start the game" calls, and this file drives
  // the #bootLoader overlay (logo + progress bar) that blocks/blurs
  // everything else meanwhile — see css/boot-loader.css.
  const MANIFEST_URL='./asset-manifest.json';

  function preloadImage(src){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(true);
      img.onerror=()=>resolve(false);
      img.src=src;
    });
  }

  function setProgress(loaded,total){
    const bar=document.querySelector('#bootLoaderProgress');
    if(bar) bar.style.width=`${total?Math.round(loaded/total*100):100}%`;
  }

  async function loadManifest(){
    try{
      const response=await fetch(MANIFEST_URL,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      return Array.isArray(data.images) ? data.images : [];
    }catch(error){
      console.warn('[asset-preload] manifest unavailable, skipping preload gate',error);
      return [];
    }
  }

  async function preloadAll(){
    const images=await loadManifest();
    let loaded=0;
    setProgress(0,images.length);
    await Promise.all(images.map(src=>preloadImage(src).then(ok=>{
      loaded++;
      setProgress(loaded,images.length);
      if(!ok) console.warn(`[asset-preload] failed to load ${src}`);
    })));
  }

  const readyPromise=preloadAll();

  readyPromise.then(()=>{
    document.body.classList.remove('assets-loading');
    const loader=document.querySelector('#bootLoader');
    if(!loader) return;
    loader.classList.add('bootLoaderHidden');
    loader.addEventListener('transitionend',()=>{ loader.hidden=true; },{once:true});
  });

  window.KeynlockAssetsReady=readyPromise;
})();
