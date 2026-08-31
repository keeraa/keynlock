  let audioCtx=null;
  const audioAssets=window.KeynlockAudioAssets||{};
  const activePlayers=new Set();
  let soundtrack=null;
  const MUSIC_VOLUME_KEY='keynlockMusicVolume';
  const savedMusicVolume=localStorage.getItem(MUSIC_VOLUME_KEY);
  let musicVolume=Math.max(0,Math.min(1,(savedMusicVolume===null?28:Number(savedMusicVolume)||0)/100));

  function assetUrl(key){
    const choices=audioAssets[key]||[];
    return choices.length ? choices[Math.floor(Math.random()*choices.length)] : '';
  }

  function playAsset(key,volume=.55){
    const src=assetUrl(key);
    if(!src) return false;
    const player=new Audio(src);
    player.preload='auto';
    player.volume=Math.max(0,Math.min(1,volume));
    activePlayers.add(player);
    const release=()=>activePlayers.delete(player);
    player.addEventListener('ended',release,{once:true});
    player.addEventListener('error',release,{once:true});
    player.play().catch(release);
    return true;
  }

  function startSoundtrack(){
    if(!soundtrack){
      const src=assetUrl('music');
      if(!src) return;
      soundtrack=new Audio(src);
      soundtrack.preload='auto';
      soundtrack.loop=true;
      soundtrack.volume=musicVolume;
    }
    soundtrack.play().then(()=>{
      document.documentElement.dataset.soundtrack='playing';
    }).catch(()=>{
      document.documentElement.dataset.soundtrack='blocked';
    });
  }

  function setMusicVolume(value){
    musicVolume=Math.max(0,Math.min(1,Number(value)||0));
    localStorage.setItem(MUSIC_VOLUME_KEY,String(Math.round(musicVolume*100)));
    if(soundtrack)soundtrack.volume=musicVolume;
    return Math.round(musicVolume*100);
  }

  function ensureAudio(){
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return null;
      audioCtx=new AC();
    }
    if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }

  function tone(freq=440,duration=.08,type='sine',gain=.035,slideTo=null){
    const ctx=ensureAudio();
    if(!ctx) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    const vol=ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(freq,now);
    if(slideTo!=null) osc.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),now+duration);
    vol.gain.setValueAtTime(.0001,now);
    vol.gain.exponentialRampToValueAtTime(gain,now+.008);
    vol.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(now);
    osc.stop(now+duration+.02);
  }

  function noise(duration=.06,gain=.025){
    const ctx=ensureAudio();
    if(!ctx) return;
    const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<length;i++) data[i]=(Math.random()*2-1)*(1-i/length);
    const src=ctx.createBufferSource();
    const vol=ctx.createGain();
    src.buffer=buffer;
    vol.gain.setValueAtTime(gain,ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    src.connect(vol).connect(ctx.destination);
    src.start();
  }

  // Haptics track the sounds: a nudge for a pin, a knock for a broken pick, a
  // roll for the lock giving. navigator.vibrate is Android-only — Safari on iOS
  // exposes no vibration API at all, so this is silently a no-op there.
  const canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  function buzz(pattern){
    if(!canBuzz) return;
    try{ navigator.vibrate(pattern); }catch(e){}
  }

  const SFX={
    uiClick(){ playAsset('uiClick',.42); },
    uiBack(){ playAsset('uiBack',.42); },
    inventoryOpen(){ playAsset('inventoryOpen',.48); },
    inventoryClose(){ playAsset('inventoryClose',.48); },
    pickDraw(){ playAsset('pickDraw',.5); },
    tensionDraw(){ playAsset('tensionDraw',.5); },
    select(){ tone(520,.045,'triangle',.022,600); },
    move(){
      buzz(12);
      if(!playAsset('pinMove',.42)){
        tone(250,.07,'triangle',.026,330);
        setTimeout(()=>tone(620,.045,'sine',.018,700),40);
      }
    },
    pinMove(){ this.move(); },
    plateMove(){ buzz(12); if(!playAsset('plateMove',.42)) this.move(); },
    blocked(){ if(!playAsset('uiDenied',.44)) tone(145,.10,'sawtooth',.025,95); },
    break(){
      buzz([28,40,28]);
      if(!playAsset('pickBreak',.58)){
        noise(.09,.036);
        tone(120,.12,'square',.022,70);
      }
    },
    survive(){ tone(390,.06,'triangle',.018,470); },
    ready(){
      if(!playAsset('lockCorrect',.52)){
        tone(660,.08,'sine',.018,820);
        setTimeout(()=>tone(880,.09,'sine',.016,990),70);
      }
    },
    wrongLock(){
      if(!playAsset('lockFail',.52)){
        tone(180,.09,'triangle',.022,130);
        setTimeout(()=>tone(130,.08,'triangle',.018,100),70);
      }
    },
    open(){
      buzz([45,55,45,55,90]);
      if(!playAsset('lockOpen',.62)){
        tone(240,.09,'triangle',.025,360);
        setTimeout(()=>tone(480,.11,'sine',.025,720),80);
        setTimeout(()=>tone(760,.16,'sine',.022,980),165);
      }
    },
    defeat(){ playAsset('missionLost',.62); },
    newRound(){ tone(330,.06,'sine',.012,410); },
    // The noise meter entering its warning band: a held, uneasy note rather
    // than a sting, so it reads as "someone is listening", not "you lost".
    alarm(){
      buzz([16,60,16]);
      tone(300,.14,'triangle',.020,250);
      setTimeout(()=>tone(240,.16,'triangle',.018,205),120);
    },
    // A bird overhead: two harsh calls, meant to be heard without looking.
    bird(){
      buzz([14,90,14]);
      tone(1180,.07,'sawtooth',.020,900);
      setTimeout(()=>tone(980,.09,'sawtooth',.018,720),150);
    },
    birdHit(){
      buzz([60,40,90]);
      noise(.13,.040);
      tone(820,.10,'square',.024,320);
      setTimeout(()=>tone(300,.16,'sawtooth',.022,150),90);
    },
    guards(){
      buzz([70,60,70,60,140]);
      tone(190,.14,'sawtooth',.026,150);
      setTimeout(()=>tone(150,.16,'sawtooth',.024,110),110);
      setTimeout(()=>tone(110,.24,'square',.022,80),230);
    }
  };

  window.KeynlockAudio={
    startSoundtrack,
    playAsset,
    setMusicVolume,
    getMusicVolume:()=>Math.round(musicVolume*100),
    getMusicState:()=>({playing:Boolean(soundtrack&&!soundtrack.paused),loop:Boolean(soundtrack?.loop)})
  };
  window.addEventListener('keynlock:audio-ready',startSoundtrack);
  window.addEventListener('keynlock:play',startSoundtrack);

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button');
    if(!button || button.disabled) return;
    if(button.closest('#inventoryDrawer,#puzzleArea,.gameDefeatOverlay')) return;
    if(button.matches('[aria-label*="Закрыть"],.shopClose,.lairWorkbenchClose')) SFX.uiBack();
    else SFX.uiClick();
  });
