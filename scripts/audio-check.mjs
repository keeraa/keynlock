import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

// Deliberately defer play(): mute and page lifecycle events can race its promise.
const handlers={window:new Map(),document:new Map()},players=[],pending=[];
const values=new Map([['keynlockMusicVolume','28']]);
const register=target=>(type,handler)=>{
  const listeners=handlers[target].get(type)||[];listeners.push(handler);handlers[target].set(type,listeners);
};
const emit=(target,type,event={})=>handlers[target].get(type)?.forEach(fn=>fn(event));
let focused=true;
class AudioPlayer{
  constructor(src){this.src=src;this.paused=true;this.muted=false;players.push(this);}
  addEventListener(){}
  play(){this.paused=false;return new Promise(resolve=>pending.push(resolve));}
  pause(){this.paused=true;}
}
const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
const document={hidden:false,hasFocus:()=>focused,documentElement:{dataset:{}},addEventListener:register('document')};
const window={KeynlockAudioAssets:{music:['music.mp3'],uiClick:['click.mp3']},KeynlockSaveStore:store,addEventListener:register('window'),dispatchEvent:event=>emit('window',event.type,event)};
const context={window,document,Audio:AudioPlayer,CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},setTimeout};
runInNewContext(readFileSync(new URL('../js/core/audio.js',import.meta.url),'utf8'),context);
const api=window.KeynlockAudio;
const flush=async()=>{pending.splice(0).forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();};
api.startSoundtrack();const music=players[0];
api.setMusicVolume(0);await flush();
assert(music.paused&&music.muted&&!api.getMusicState().playing,'Muting must stop pending playback.');
emit('window','keynlock:play');assert(music.paused,'Starting a round must respect mute.');
api.setMusicVolume(.4);await flush();assert(api.getMusicState().playing);
api.playAsset('uiClick');const effect=players[1];
focused=false;emit('window','blur');await flush();
assert(music.paused&&effect.paused&&effect.muted,'Blur must stop music and effects.');
api.startSoundtrack();assert(music.paused,'Background play requests must be ignored.');
focused=true;emit('window','focus');await flush();assert(api.getMusicState().playing);
document.hidden=true;emit('document','visibilitychange');assert(music.paused);
document.hidden=false;emit('document','visibilitychange');await flush();assert(api.getMusicState().playing);
emit('window','pagehide');emit('window','focus');await flush();assert(music.paused,'Focus must not override pagehide.');
emit('window','pageshow');await flush();assert(api.getMusicState().playing);
values.set('keynlockMusicVolume','0');emit('window','storage',{key:'keynlockMusicVolume'});await flush();
assert.equal(api.getMusicVolume(),0);assert(music.paused,'Mute in another tab must stop this player.');
emit('window','pageshow');emit('window','focus');await flush();assert(music.paused,'Returning must preserve zero volume.');
assert.equal(players.filter(player=>player.src==='music.mp3').length,1,'Repeated resumes must reuse one player.');
console.log('Audio lifecycle OK — mute races, focus, visibility, pagehide, restore and cross-tab settings.');

api.setMusicVolume(.2);await flush();
api.setSoundVolume(.5);
api.playAsset('uiClick',.4);const quietEffect=players.at(-1);
assert.equal(quietEffect.volume,.2,'Effects must scale their original mix volume.');
api.setSoundVolume(0);
assert.equal(quietEffect.volume,0,'The slider must also silence an effect already playing.');
assert(api.getMusicState().playing,'Effects volume must not change music.');
const count=players.length;api.playAsset('uiClick');assert.equal(players.length,count,'Muted effects must not start new players.');
values.set('keynlockSoundVolume','25');emit('window','storage',{key:'keynlockSoundVolume'});
assert.equal(api.getSoundVolume(),25,'Effects volume must synchronize across tabs.');
window.AudioContext=class{
  state='running';currentTime=0;destination={};
  createGain(){return {gain:{value:1,setValueAtTime(value){this.value=value;}},connect(){return this;}};}
  suspend(){this.state='suspended';return Promise.resolve();}
  resume(){this.state='running';return Promise.resolve();}
};
const effectsContext=api.getEffectsContext();
assert.equal(api.getEffectsOutput().gain.value,.25,'Synthesized puzzle sounds must use the effects mixer.');
api.setSoundVolume(0);assert.equal(api.getEffectsOutput().gain.value,0,'Active synthesized effects must be muted.');
assert.equal(api.getEffectsContext(),null,'Do not generate synthesized effects at zero volume.');
emit('window','pagehide');assert.equal(effectsContext.state,'suspended','The shared puzzle context must suspend in the background.');
console.log('Effects volume OK — independent music, active clips, shared synthesis and cross-tab settings.');
