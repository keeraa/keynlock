import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {createHangingTutorial} from '../src/ui/hanging-tutorial.js';
import {createTutorialGuide} from '../src/ui/tutorial-guide.js';
import {tutorialWorks,scatterFloor} from '../src/paintings/floor-scatter.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
import {PLAYER_DEFAULTS} from '../config/runtime.js';
import {STORAGE_KEYS} from '../src/persistence/storage.js';
const json=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const config=json('../config/scene.json'),layout=makeLayout(config);
const page=arrangeExhibition(json('../catalog/manifest.json'),json('../catalog/initial-selection.json'),layout,config.paintings).slots(0);

test('tutorial teaches a wrong pickup and completed throw, then two different galleries, retaining progress',t=>{
 const saved=[globalThis.window,globalThis.localStorage],memory=new Map();
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{[globalThis.window,globalThis.localStorage]=saved;});
 const [first,second,wrong]=tutorialWorks(page,config.paintings);
 assert.notEqual(first.wall.hall,second.wall.hall);
 assert.equal(new Set([first,second,wrong].map(s=>s.painting.id)).size,3);
 const poses=new Map(scatterFloor(page,layout,config).map(s=>[s.painting.id,s]));
 for(const slot of [first,second,wrong]){
  const pose=poses.get(slot.painting.id);
  assert.equal(pose.faceDown,false);
  assert(Math.hypot(pose.x-PLAYER_DEFAULTS.spawn.x,pose.z-PLAYER_DEFAULTS.spawn.z)<4);
 }
 const node={},archiveTask={},tutorial=createHangingTutorial(node,archiveTask,layout,config.paintings);
 tutorial.setPage(page,id=>poses.get(id));
 assert.equal(tutorial.target().slot.painting.id,wrong.painting.id);
 tutorial.update(wrong.painting.id);
 assert.match(node.textContent,/А это не.*Посмотрите вниз.*бросить/);
 assert.equal(tutorial.target().kind,'drop');
 tutorial.update(null,'idle'); // Placing it down without a throw offers the pickup again.
 assert.equal(tutorial.target().slot.painting.id,wrong.painting.id);
 tutorial.update(wrong.painting.id);
 tutorial.update(null); // A temporarily empty hand alone must not complete the throwing lesson.
 assert.equal(tutorial.target().kind,'drop');
 tutorial.thrown(first);assert.equal(tutorial.target().kind,'drop');
 tutorial.thrown(wrong);assert.equal(tutorial.target().slot.painting.id,first.painting.id);
 tutorial.update(first.painting.id);assert.equal(tutorial.target().hall.id,first.wall.hall);
 poses.set(first.painting.id,first);tutorial.mounted(first);tutorial.update(null);
 assert.equal(node.hidden,false);assert.match(node.textContent,/Теперь другой зал/);
 assert.notEqual(memory.get(STORAGE_KEYS.tutorial),'done');
 const resumed=createHangingTutorial({}, {},layout,config.paintings);
 resumed.setPage(page,id=>poses.get(id));assert.equal(resumed.target().slot.painting.id,second.painting.id);
 resumed.update(second.painting.id);assert.equal(resumed.target().hall.id,second.wall.hall);
 poses.set(first.painting.id,{...first,floorAngle:0}); // The first completed lesson remains learned.
 poses.set(second.painting.id,second);resumed.mounted(second);assert.equal(resumed.target(),null);
 assert.equal(memory.get(STORAGE_KEYS.tutorial),'done');
});

test('objective marker follows moved paintings, stays on screen behind the player and hides when paused',t=>{
 const prior=globalThis.document;
 class Element{constructor(){this.style={};this.dataset={};this.children=[];}setAttribute(){}append(...nodes){this.children.push(...nodes);}remove(){this.removed=true;}}
 globalThis.document={createElement:()=>new Element()};t.after(()=>{globalThis.document=prior;});
 const parent=new Element(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
 camera.position.set(0,9.6,0);camera.lookAt(0,9.6,-10);
 const guide=createTutorialGuide({THREE,camera,layout,floorElevation:8,parent}),marker=parent.children[0];
 const target={kind:'painting',label:'Painting',slot:{x:0,y:1.6,z:-5}};
 guide.update(target,true);assert.equal(marker.dataset.edge,'false');assert.equal(marker.style.left,'50%');
 target.slot.x=3;guide.update(target,true);assert.notEqual(marker.style.left,'50%');
 target.slot.z=5;guide.update(target,true);assert.equal(marker.dataset.edge,'true');
 assert(Number.parseFloat(marker.style.left)>=9&&Number.parseFloat(marker.style.left)<=91.01);
 guide.update(target,false);assert.equal(marker.hidden,true);
 guide.update(null,true);assert.equal(marker.hidden,true);
 guide.dispose();assert.equal(marker.removed,true);
});
