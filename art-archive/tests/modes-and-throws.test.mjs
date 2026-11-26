import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {throwTargets} from '../src/paintings/floor-drop.js';
import {createPlaytestStatistics} from '../src/playtest/statistics.js';
import {bindPlayerSettings} from '../src/ui/settings.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config);
const painting={id:'test',physicalSizeM:{width:.2,height:.3}};
const slot={painting,width:.2+2*config.paintings.frameWidthM,height:.3,wall:{hall:'cn'}};
test('a far floor reticle and an upward aim produce short forward-only throw targets',()=>{
 const hall=layout.halls.find(h=>h.id==='cn'),start=layout.world(hall,0,hall.start+4),forward=layout.world(hall,0,hall.start+5);
 const origin={x:start.x,y:1.7,z:start.z},dx=forward.x-start.x,dz=forward.z-start.z;
 for(const vertical of [-.02,.3]){
  const length=Math.hypot(dx,dz,vertical),dir={x:dx/length,y:vertical/length,z:dz/length};
  const targets=throwTargets(slot,origin,dir,hall.id,layout,config,[]);
  assert(targets.length);assert(targets.every(t=>t.weak));
  for(const {slot:target}of targets){
   const x=target.x-origin.x,z=target.z-origin.z;
   assert(x*dir.x+z*dir.z>0,'a weak throw must still go forward');
   assert(Math.abs(x*dir.z-z*dir.x)<1e-6,'no sideways fallback');
   assert(Math.hypot(x,z)<=2.6+1e-6,'weaker throws land nearby');
  }
 }
});
test('the mode report distinguishes the four combinations and their active play time',()=>{
 let now=0;const data=new Map(),stats=createPlaytestStatistics({now:()=>now,storage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}});
 stats.setMode('play');
 stats.setModes({placement:'blocks',difficulty:'normal'});stats.track('mode_selected',{placement:'blocks',difficulty:'normal'});now=1000;
 stats.setModes({placement:'blocks',difficulty:'hard'});stats.track('mode_selected',{placement:'blocks',difficulty:'hard'});now=3000;
 const report=stats.report();assert.equal(report.modeSelections.blocks_normal,1);assert.equal(report.modeSelections.blocks_hard,1);assert.equal(report.modeActiveMs.blocks_normal,1000);assert.equal(report.modeActiveMs.blocks_hard,2000);assert.equal(report.modes.difficulty,'hard');
 stats.setFreePlacement(true);stats.setModes({placement:'free',difficulty:'normal'});stats.track('mode_selected',{placement:'free',difficulty:'normal'});now=4000;stats.setModes({placement:'free',difficulty:'hard'});stats.track('mode_selected',{placement:'free',difficulty:'hard'});now=6000;
 const free=stats.report();assert.equal(free.modeSelections.free_normal,1);assert.equal(free.modeSelections.free_hard,1);assert.equal(free.modeActiveMs.free_normal,1000);assert.equal(free.modeActiveMs.free_hard,2000);
});
test('settings report restored choices and each placement/difficulty change with both current values',t=>{
 const previous=[globalThis.window,globalThis.localStorage];globalThis.window={};globalThis.localStorage={getItem:()=>JSON.stringify({freePlacement:true,hardMode:true,distanceBlur:false}),setItem(){}};
 t.after(()=>{[globalThis.window,globalThis.localStorage]=previous;});
 const nodes=new Map(),elements=id=>{if(!nodes.has(id))nodes.set(id,Object.assign(new EventTarget(),{value:'',checked:false}));return nodes.get(id);};
 const choices=[],noop=()=>{};let lighting=null,placementEffect=null;
 const controls=bindPlayerSettings({elements,onModeSelection:value=>choices.push(value),player:{state:{}},painted:{setSettings:value=>lighting=value},collection:{setPlacementEffect:value=>placementEffect=value,setFreePlacement:noop,setStyle:noop,setPigment:noop,setEasyMode:noop},dust:{setEnabled:noop},ink:{setEnabled:noop},setSkyColor:noop,setWallFinish:noop,setFrameLimit:noop});t.after(()=>controls.dispose());
 assert.equal(elements('toon').checked,false);assert.equal(placementEffect,'smoke');
 assert.equal(lighting.distanceBlurEnabled,true,'retired depth setting cannot disable the permanent effect');
 assert(!nodes.has('distance-blur'),'the removed control must not be queried or bound');
 assert.deepEqual(choices[0],{placement:'free',difficulty:'hard',source:'initial',changed:'none'});
 elements('free-placement').checked=false;elements('free-placement').dispatchEvent(new Event('change'));
 elements('hard-mode').checked=false;elements('hard-mode').dispatchEvent(new Event('change'));
 assert.deepEqual(choices.slice(1).map(v=>[v.placement,v.difficulty,v.changed]),[['blocks','hard','placement'],['blocks','normal','difficulty']]);
});
