  let audioCtx=null;

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

  const SFX={
    select(){ tone(520,.045,'triangle',.022,600); },
    move(){
      tone(250,.07,'triangle',.026,330);
      setTimeout(()=>tone(620,.045,'sine',.018,700),40);
    },
    blocked(){ tone(145,.10,'sawtooth',.025,95); },
    break(){
      noise(.09,.036);
      tone(120,.12,'square',.022,70);
    },
    survive(){ tone(390,.06,'triangle',.018,470); },
    ready(){
      tone(660,.08,'sine',.018,820);
      setTimeout(()=>tone(880,.09,'sine',.016,990),70);
    },
    wrongLock(){
      tone(180,.09,'triangle',.022,130);
      setTimeout(()=>tone(130,.08,'triangle',.018,100),70);
    },
    open(){
      tone(240,.09,'triangle',.025,360);
      setTimeout(()=>tone(480,.11,'sine',.025,720),80);
      setTimeout(()=>tone(760,.16,'sine',.022,980),165);
    },
    newRound(){ tone(330,.06,'sine',.012,410); }
  };

