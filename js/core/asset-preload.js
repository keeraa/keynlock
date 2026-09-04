(function(){
  'use strict';
  // Preloads shared interface/gameplay art from asset-manifest.json before the
  // game boots. The 127 MB restoration gallery loads on demand when opened;
  // decoding it all here could make memory-constrained mobile tabs restart.
  // js/core/init.js awaits window.KeynlockAssetsReady
  // before running its final "start the game" calls, and this file drives
  // the #bootLoader overlay (logo + progress bar) that blocks/blurs
  // everything else meanwhile — see css/boot-loader.css.
  const MANIFEST_URL='./asset-manifest.json';
  const BOOT_PRELOAD_CONCURRENCY=4;
  const AUDIO_ASSETS=Object.freeze({
    music:['./assets/audio/locksmith-alley.mp3'],
    inventoryOpen:['./assets/audio/inv_open_01.wav'],
    inventoryClose:['./assets/audio/inv_closed_01.wav'],
    pickBreak:['./assets/audio/inv_pick_break_01.wav'],
    pickDraw:['./assets/audio/inv_pick_draw_01.wav'],
    tensionDraw:['./assets/audio/inv_tension_draw_01.wav'],
    lockCorrect:['./assets/audio/lock_correct_01.wav'],
    lockFail:['./assets/audio/lock_fail_shake_01.wav','./assets/audio/lock_fail_shake_02.wav','./assets/audio/lock_fail_shake_03.wav'],
    lockOpen:['./assets/audio/lock_open_01.wav','./assets/audio/lock_open_02.wav'],
    pinMove:['./assets/audio/lock_pin_move_01.wav'],
    plateMove:['./assets/audio/lock_plastine_move_01.wav'],
    missionLost:['./assets/audio/mission_lost_01.wav'],
    uiBack:['./assets/audio/ui_back_01.wav'],
    uiClick:['./assets/audio/ui_click_01.wav'],
    uiDenied:['./assets/audio/ui_denied_01.wav']
  });
  window.KeynlockAudioAssets=AUDIO_ASSETS;

  const imageLoads=new Map();

  function preloadImage(src){
    if(!src) return Promise.resolve(false);
    if(imageLoads.has(src)) return imageLoads.get(src);
    const load=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(true);
      img.onerror=()=>resolve(false);
      img.src=src;
    });
    imageLoads.set(src,load);
    return load;
  }

  window.KeynlockPreloadImages=sources=>Promise.all(
    [...new Set((sources||[]).filter(Boolean))].map(preloadImage)
  );

  function preloadAudio(src){
    return new Promise(resolve=>{
      const audio=new Audio();
      let settled=false;
      const finish=ok=>{
        if(settled) return;
        settled=true;
        clearTimeout(timeout);
        audio.removeEventListener('canplaythrough',onReady);
        audio.removeEventListener('error',onError);
        resolve(ok);
      };
      const onReady=()=>finish(true);
      const onError=()=>finish(false);
      const timeout=setTimeout(()=>finish(audio.readyState>=2),20000);
      audio.preload='auto';
      audio.addEventListener('canplaythrough',onReady,{once:true});
      audio.addEventListener('error',onError,{once:true});
      audio.src=src;
      audio.load();
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
    const images=(await loadManifest()).filter(src=>!src.startsWith('assets/restoration/'));
    const sounds=[...new Set(Object.values(AUDIO_ASSETS).flat())];
    const assets=[...images.map(src=>({src,type:'image'})),...sounds.map(src=>({src,type:'audio'}))];
    let loaded=0;
    setProgress(0,assets.length);
    let cursor=0;
    async function worker(){
      while(cursor<assets.length){
        const {src,type}=assets[cursor++];
        const ok=await (type==='image'?preloadImage(src):preloadAudio(src));
        loaded++;
        setProgress(loaded,assets.length);
        if(!ok) console.warn(`[asset-preload] failed to load ${src}`);
      }
    }
    await Promise.all(Array.from({length:Math.min(BOOT_PRELOAD_CONCURRENCY,assets.length)},worker));
  }

  const readyPromise=preloadAll();

  const stage=document.querySelector('.bootLoaderStage');
  if(stage && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    let frame=0;
    const setParallax=(x=0,y=0)=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        stage.style.setProperty('--boot-parallax-x',`${x.toFixed(2)}px`);
        stage.style.setProperty('--boot-parallax-y',`${y.toFixed(2)}px`);
      });
    };
    stage.addEventListener('pointermove',event=>{
      const rect=stage.getBoundingClientRect();
      setParallax(((event.clientX-rect.left)/rect.width-.5)*10,((event.clientY-rect.top)/rect.height-.5)*7);
    });
    stage.addEventListener('pointerleave',()=>setParallax());
  }

  readyPromise.then(()=>{
    document.body.classList.add('assets-ready');
    window.dispatchEvent(new CustomEvent('keynlock:audio-ready'));
    window.KeynlockMainMenu?.assetsReady();
  });

  window.KeynlockAssetsReady=readyPromise;
})();
