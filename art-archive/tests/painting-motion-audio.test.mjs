import test from 'node:test';
import assert from 'node:assert/strict';
import {heaviestPaintingIds,createPaintingMotionAudio,createFrameFitAudio} from '../src/audio/painting-motion-audio.js';

test('heavy scraping is restricted to five distinct largest trolley paintings',()=>{
 const slots=Array.from({length:9},(_,i)=>({painting:{id:'p'+i,physicalSizeM:{width:i+1,height:2}},width:i+1,height:2}));
 const selected=heaviestPaintingIds([...slots,slots[8]],slot=>slot.width>=3);
 assert.deepEqual([...selected],['p8','p7','p6','p5','p4']);
 assert.equal(selected.has('p3'),false);
});
test('movement audio stops when stationary, paused, lifted or no longer carrying',()=>{
 const calls=[],motion=createPaintingMotionAudio(kind=>calls.push(kind));
 const state={playing:true,slot:{painting:{id:'large'}},large:true,heavy:false,placing:false,raised:false,position:{x:0,z:0},now:0};
 motion.update(state);
 motion.update({...state,position:{x:1,z:0},now:100});assert.equal(calls.at(-1),'trolley');
 motion.update({...state,position:{x:1,z:0},now:200});assert.equal(calls.at(-1),null);
 motion.update({...state,position:{x:2,z:0},heavy:true,now:300});assert.equal(calls.at(-1),'heavyDrag');
 motion.update({...state,playing:false,now:400});assert.equal(calls.at(-1),null);
 motion.update({...state,raised:true,now:500});assert.equal(calls.at(-1),null);
 motion.update({...state,slot:null,now:600});assert.equal(calls.at(-1),null);
});
test('wall scraping follows aim movement, without starting trolley audio for camera motion',()=>{
 const calls=[],motion=createPaintingMotionAudio(kind=>calls.push(kind));
 const state={playing:true,slot:{painting:{id:'large'}},large:true,heavy:true,placing:true,raised:false,position:{x:0,z:0},wallPosition:{x:0,y:1},now:0};
 motion.update(state);motion.update({...state,wallPosition:{x:.1,y:1},now:100});assert.equal(calls.at(-1),'wallSlide');
 motion.update({...state,position:{x:1,z:0},wallPosition:{x:.1,y:1},now:200});assert.equal(calls.at(-1),null);
});
test('the frame-fit cue fires on entry and a different matching frame, not every render frame',()=>{
 const sounds=[],fit=createFrameFitAudio(kind=>sounds.push(kind));
 fit.update(null);fit.update('frame-a');for(let i=0;i<120;i++)fit.update('frame-a');
 assert.deepEqual(sounds,['frameFit']);
 fit.update('frame-b');assert.equal(sounds.length,2);
 fit.update(null);fit.update('frame-b');assert.equal(sounds.length,3);
});
