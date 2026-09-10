(function(){
  'use strict';
  // Download the complete image and sound library before enabling the menu.
  // Fetch warms the HTTP cache without decoding the whole painting gallery.
  const MANIFEST_URL='./asset-manifest.json';
  const PRELOAD_CONCURRENCY=4;
  const IMAGE_TIMEOUT_MS=30000;
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
      let settled=false;
      const finish=ok=>{
        if(settled)return;
        settled=true;
        clearTimeout(timeout);
        img.onload=null;img.onerror=null;
        resolve(ok);
      };
      const timeout=setTimeout(()=>{
        finish(false);
        img.removeAttribute('src');
      },IMAGE_TIMEOUT_MS);
      img.onload=()=>finish(true);
      img.onerror=()=>finish(false);
      img.src=src;
    });
    // A failed request can be retried when the player opens that scene again.
    load.then(ok=>{if(!ok&&imageLoads.get(src)===load)imageLoads.delete(src);});
    imageLoads.set(src,load);
    return load;
  }

  window.KeynlockPreloadImages=sources=>Promise.all(
    [...new Set((sources||[]).filter(Boolean))].map(preloadImage)
  );

  function setProgress(loaded,total){
    const bar=document.querySelector('#bootLoaderProgress');
    if(bar) bar.style.width=`${total?Math.round(loaded/total*100):100}%`;
  }

  function setStatus(text){
    const status=document.querySelector('#bootLoaderStatus');
    if(status)status.textContent=text;
  }

  async function fetchResource(src,{manifest=false}={}){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),IMAGE_TIMEOUT_MS);
    try{
      const response=await fetch(src,{cache:manifest?'no-store':'force-cache',signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}: ${src}`);
      // Reading the full body matters: headers and canplaythrough do not mean
      // the whole image or sound has been downloaded yet.
      return manifest?await response.json():await response.arrayBuffer();
    }finally{clearTimeout(timeout);}
  }

  async function waitForRetry(message){
    setStatus(message);
    const button=document.querySelector('#bootLoaderRetry');
    button.hidden=false;
    await new Promise(resolve=>button.addEventListener('click',resolve,{once:true}));
    button.hidden=true;
  }

  async function preloadAll(){
    let images;
    while(!images){
      try{
        const manifest=await fetchResource(MANIFEST_URL,{manifest:true});
        if(!Array.isArray(manifest.images)||!manifest.images.length||manifest.images.some(src=>typeof src!=='string'||!src.startsWith('assets/')))
          throw new Error('Invalid image manifest');
        images=manifest.images;
      }catch(error){
        console.warn('[asset-preload] manifest unavailable',error);
        await waitForRetry('Не удалось начать загрузку. Проверь соединение и попробуй ещё раз.');
      }
    }
    let pending=[...new Set([...images,...Object.values(AUDIO_ASSETS).flat()])];
    const total=pending.length;
    let loaded=0;
    while(pending.length){
      const failed=[];
      let cursor=0;
      setProgress(loaded,total);
      setStatus('Загружаем игру…');
      async function worker(){
        while(cursor<pending.length){
          const src=pending[cursor++];
          try{await fetchResource(src);loaded++;}
          catch(error){failed.push(src);console.warn(`[asset-preload] failed: ${src}`,error);}
          setProgress(loaded,total);
        }
      }
      await Promise.all(Array.from({length:Math.min(PRELOAD_CONCURRENCY,pending.length)},worker));
      pending=failed;
      if(pending.length)await waitForRetry('Не все ресурсы загрузились. Повтори загрузку оставшихся файлов.');
    }
    setStatus('');
  }

  // Cached images may finish before the remaining scripts register the menu.
  const scriptsReady=document.readyState==='loading'
    ? new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}))
    : Promise.resolve();
  const readyPromise=Promise.all([preloadAll(),scriptsReady]);

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
    performance.mark('keynlock-menu-ready');
    document.body.classList.add('assets-ready');
    window.dispatchEvent(new CustomEvent('keynlock:audio-ready'));
    window.KeynlockMainMenu?.assetsReady();
  });

  window.KeynlockAssetsReady=readyPromise;
})();
