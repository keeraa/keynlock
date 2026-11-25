import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createArchiveAudio} from '../src/audio/archive-audio.js';

async function fixture(t){
 const previousFetch=globalThis.fetch,previousAudio=globalThis.AudioContext;
 const contexts=[];
 class Context{
  constructor(){this.state='running';this.currentTime=0;this.destination={output:true};this.sources=[];this.closeCount=0;contexts.push(this);}
  createGain(){return {gain:{value:0,setTargetAtTime(){},cancelScheduledValues(){}},connect(to){this.to=to;},disconnect(){}};}
  createBufferSource(){const source={connect(to){this.to=to;},disconnect(){},start(when=0){this.started=true;this.when=when;},stop(){this.stopped=true;},playbackRate:{value:1}};this.sources.push(source);return source;}
  decodeAudioData(url){return Promise.resolve({url,duration:1});}
  resume(){return Promise.resolve();}
  close(){this.closeCount++;this.state='closed';return Promise.resolve();}
 }
 globalThis.AudioContext=Context;
 globalThis.fetch=async url=>({ok:true,arrayBuffer:async()=>String(url)});
 const audio=createArchiveAudio({halls:[]});
 t.after(()=>{audio.dispose();globalThis.fetch=previousFetch;if(previousAudio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=previousAudio;});
 audio.setPlaying(true);await new Promise(resolve=>setImmediate(resolve));
 return {audio,context:contexts[0]};
}
test('wood steps preserve their selected recordings and do not repeat the last clip',async t=>{
 const {audio,context}=await fixture(t);
 audio.play('wood');audio.play('wood');
 assert.equal(context.sources.length,2);
 assert.notEqual(context.sources[0].buffer.url,context.sources[1].buffer.url);
 assert.match(context.sources[0].buffer.url,/selected\/wood-step-/);
 assert.equal(context.sources[0].loop,false);
});
test('pausing stops movement audio and world cues while allowing the menu cue',async t=>{
 const {audio,context}=await fixture(t);
 audio.setMotion('trolley');const cart=context.sources.at(-1);assert.equal(cart.loop,true);
 audio.setPlaying(false);assert.equal(cart.stopped,true);
 const count=context.sources.length;audio.play('mount');assert.equal(context.sources.length,count);
 audio.play('menu');assert.equal(context.sources.length,count+1);
 const menu=context.sources.at(-1);assert.match(menu.buffer.url,/selected\/menu.wav$/);
 assert.equal(menu.to.to,context.destination);
});
test('random heavy segments stop scheduling on release and disposal closes the context once',async t=>{
 const {audio,context}=await fixture(t);
 audio.setMotion('heavyDrag');const first=context.sources.at(-1);assert.equal(first.loop,false);
 first.onended();const second=context.sources.at(-1);
 assert.notEqual(first.buffer.url,second.buffer.url);
 audio.setMotion(null);assert.equal(second.stopped,true);
 const count=context.sources.length;second.onended();assert.equal(context.sources.length,count);
 audio.dispose();audio.dispose();assert.equal(context.closeCount,1);
 audio.play('menu');audio.setMotion('heavyDrag');assert.equal(context.sources.length,count);
});
test('placement chime starts with the frame contact, and a new contact cancels both rewards',async t=>{
 const {audio,context}=await fixture(t);
 audio.setMotion('wallSlide');const slide=context.sources.at(-1);
 audio.play('mount');const mount=context.sources.at(-1);assert.equal(slide.stopped,true);
 audio.play('correctPlace');const reward=context.sources.at(-1);
 assert.equal(reward.when,mount.when);
 audio.play('hallComplete',undefined,{after:'correctPlace'});const hall=context.sources.at(-1);
 assert(hall.when>=reward.when+reward.buffer.duration+.12);
 audio.play('unmount');assert.equal(mount.stopped,true);assert.equal(reward.stopped,true);
 assert.equal(hall.stopped,true);
 const removal=context.sources.at(-1);assert.equal(removal.when,context.currentTime);
 assert.match(removal.buffer.url,/unmount.wav$/);
});
test('the retired watercolor cue cannot add another sound to the visual effect',async t=>{
 const {audio,context}=await fixture(t);
 audio.play('watercolor');assert.equal(context.sources.length,0);
});
function initialRms(file){
 const wav=fs.readFileSync(new URL('../assets/audio/selected/'+file,import.meta.url));
 let offset=12,channels,rate,pcm;
 while(offset+8<=wav.length){
  const id=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4),start=offset+8;
  if(id==='fmt '){channels=wav.readUInt16LE(start+2);rate=wav.readUInt32LE(start+4);assert.equal(wav.readUInt16LE(start+14),16);}
  if(id==='data')pcm=wav.subarray(start,start+size);
  offset=start+size+(size%2);
 }
 assert(pcm&&rate&&channels);
 const samples=Math.min(pcm.length/2,Math.floor(rate*.08)*channels);
 let sum=0;for(let i=0;i<samples;i++)sum+=(pcm.readInt16LE(i*2)/32768)**2;
 return Math.sqrt(sum/samples);
}
test('the removal contact and placement chime have audible onsets within the first 80 ms',()=>{
 assert(initialRms('unmount.wav')>.02);
 assert(initialRms('correct-place.wav')>.015);
});
