import {SELECTED_RECORDINGS,SELECTED_LEVELS} from './selected-clips.js';

const recordings={
  ...SELECTED_RECORDINGS,
  rug:Array.from({length:4},(_,i)=>'footsteps/rug-'+(i+1)+'.wav'),
};
const levels=SELECTED_LEVELS;
const cooldowns={deny:.3,menu:.12,correctPlace:.3,frameFit:.25};

export function createArchiveAudio(layout){
  let context,master,loading,playing=false,disposed=false;
  let stride=0,walking=false,motion=null;
  const buffers=new Map(),requests=new AbortController(),voices=new Set(),lastClip=new Map(),lastPlayed=new Map();

  async function loadClip(audio,file){
    try{
      const response=await fetch(new URL('../../assets/audio/'+file,import.meta.url),{signal:requests.signal});
      if(!response.ok)return;
      const decoded=await audio.decodeAudioData(await response.arrayBuffer());
      if(!requests.signal.aborted)buffers.set(file,decoded);
    }catch { /* Missing audio should not interrupt the archive. */ }
  }
  function initialize(){
    if(disposed)return false;
    const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;
    if(!Audio)return false;
    try{
      if(!context){context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);}
      if(context.state!=='running')void context.resume().catch(()=>{});
      loading??=Promise.all([...new Set(Object.values(recordings).flat())].map(file=>loadClip(context,file)));
      return true;
    }catch{return false;}
  }
  function stopMotion(){
    const prior=motion;motion=null;
    if(prior?.voice&&context){
      prior.voice.gain.gain.cancelScheduledValues(context.currentTime);
      prior.voice.gain.gain.setTargetAtTime(0,context.currentTime,.025);
      try{prior.voice.source.stop(context.currentTime+.12);}catch{}
    }
  }
  function setPlaying(value){
    playing=Boolean(value)&&!disposed;
    if(playing)initialize();
    else{walking=false;stride=0;stopMotion();}
    if(master)master.gain.setTargetAtTime(playing?.66:0,context.currentTime,.012);
  }
  function spawn(kind,volume,{loop=false,onEnded,delay=0}={}){
    const files=recordings[kind]?.filter(file=>buffers.has(file));
    if(!files?.length||disposed||context?.state!=='running')return null;
    const choices=files.length>1?files.filter(file=>file!==lastClip.get(kind)):files;
    const file=choices[Math.floor(Math.random()*choices.length)];lastClip.set(kind,file);
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=buffers.get(file);source.loop=loop;
    source.playbackRate.value=kind==='wood'||kind==='rug'?.98+Math.random()*.04:1;
    gain.gain.value=volume??levels[kind]??.4;
    const pan=['trolley','heavyDrag'].includes(kind)&&context.createStereoPanner?context.createStereoPanner():null;
    if(pan)pan.pan.value=.62;
    source.connect(gain);
    if(pan){gain.connect(pan);pan.connect(master);}else gain.connect(kind==='menu'?context.destination:master);
    const startAt=context.currentTime+delay;
    const voice={source,gain,kind,startAt,endAt:loop?Infinity:startAt+source.buffer.duration/source.playbackRate.value};voices.add(voice);
    source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();pan?.disconnect();onEnded?.();};
    source.start(startAt);return voice;
  }
  function play(kind,volume=levels[kind],{after}={}){
    if(disposed||(!playing&&kind!=='menu')||context?.state!=='running')return;
    const now=context.currentTime;
    if(now-(lastPlayed.get(kind)??-Infinity)<(cooldowns[kind]??0))return;
    // Physical contacts replace any previous contact or unfinished reward.
    if(['mount','pickup','unmount','frameFit'].includes(kind)){
      stopMotion();
      for(const prior of voices){
        if(!['mount','pickup','unmount','frameFit','correctPlace','hallComplete'].includes(prior.kind))continue;
        prior.gain.gain.setTargetAtTime(0,now,.008);
        try{prior.source.stop(now+.035);}catch{}
      }
    }
    const priorEnd=after?Math.max(now,...[...voices].filter(voice=>voice.kind===after).map(voice=>voice.endAt)):now;
    const voice=spawn(kind,volume,{delay:after?Math.max(0,priorEnd-now)+.12:0});
    if(voice)lastPlayed.set(kind,now);
    return voice;
  }
  function setMotion(kind){
    if(!playing||disposed)kind=null;
    if(motion?.kind===kind||(!motion&&!kind))return;
    stopMotion();
    if(!kind)return;
    const state={kind,voice:null};motion=state;
    function next(){
      if(motion!==state||!playing||disposed)return;
      state.voice=spawn(kind,levels[kind],{loop:kind==='trolley',onEnded:next});
    }
    next();
    if(!state.voice)loading?.then(()=>{if(!state.voice)next();});
  }
  function walk(distance,position,floorY,running){
    if(distance<.0001){walking=false;stride=0;return;}
    const interval=running?2.13:1.76;
    if(!walking)stride=interval-.35;
    walking=true;stride+=distance;
    if(stride<interval)return;
    stride-=interval;
    const onRug=floorY===0&&layout.halls.some(hall=>{
      const point=layout.local(hall,position.x,position.z),{start,end,width}=hall.rug;
      return point.z>=start&&point.z<=end&&Math.abs(point.x)<=width/2;
    });
    play(onRug?'rug':'wood',running?.48:.4);
  }
  return {setPlaying,play,walk,setMotion,dispose(){
    if(disposed)return;
    playing=false;stopMotion();disposed=true;requests.abort();buffers.clear();
    for(const voice of voices){try{voice.source.stop();}catch{}}
    voices.clear();
    if(context&&context.state!=='closed')void context.close().catch(()=>{});
  }};
}
