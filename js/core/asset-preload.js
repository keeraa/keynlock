(function(){
  'use strict';
  // Preloads every image under assets/ (per the generated asset-manifest.json)
  // before the game boots. js/core/init.js awaits window.KeynlockAssetsReady
  // before running its final "start the game" calls, and this file drives
  // the #bootLoader overlay (logo + progress bar) that blocks/blurs
  // everything else meanwhile — see css/boot-loader.css.
  const MANIFEST_URL='./asset-manifest.json';
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

  function preloadImage(src){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(true);
      img.onerror=()=>resolve(false);
      img.src=src;
    });
  }

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
    const images=await loadManifest();
    const sounds=[...new Set(Object.values(AUDIO_ASSETS).flat())];
    const assets=[...images.map(src=>({src,type:'image'})),...sounds.map(src=>({src,type:'audio'}))];
    let loaded=0;
    setProgress(0,assets.length);
    await Promise.all(assets.map(({src,type})=>(type==='image'?preloadImage(src):preloadAudio(src)).then(ok=>{
      loaded++;
      setProgress(loaded,assets.length);
      if(!ok) console.warn(`[asset-preload] failed to load ${src}`);
    })));
  }

  const readyPromise=preloadAll();

  readyPromise.then(()=>{
    const loader=document.querySelector('#bootLoader');
    const play=document.querySelector('#bootLoaderPlay');
    const caption=document.querySelector('#bootLoaderCaption');
    if(caption) caption.textContent='Всё готово';
    document.body.classList.add('assets-ready');
    if(play) play.hidden=false;
    play?.addEventListener('click',()=>{
      window.dispatchEvent(new CustomEvent('keynlock:play'));
      document.body.classList.remove('assets-loading');
      if(!loader) return;
      loader.classList.add('bootLoaderHidden');
      loader.addEventListener('transitionend',()=>{ loader.hidden=true; },{once:true});
    },{once:true});
  });

  window.KeynlockAssetsReady=readyPromise;
})();
