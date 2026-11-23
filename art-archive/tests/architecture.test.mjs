import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {makeLayout} from '../src/architecture/layout.js';
import {createNavigation} from '../src/player/movement.js';
const config=JSON.parse(await fs.readFile(new URL('../config/scene.json',import.meta.url)));
test('all six corridors are open, exterior walls block movement',()=>{
 const layout=makeLayout(config),nav=createNavigation(config,layout);
 for(const hall of layout.halls){
  for(let z=5;z<hall.start+hall.length-.4;z+=.1){const p=layout.world(hall,0,z);assert.equal(nav.floorAt(p.x,p.z,0),0,`${hall.id}: ${z}`);}
  const p=layout.world(hall,hall.width/2+1,hall.start+18);assert.equal(nav.floorAt(p.x,p.z,0),null);
 }
 for(const s of layout.centerSegments)assert(!layout.inWing((s.a.x+s.b.x)/2,(s.a.z+s.b.z)/2,-.19),'Rotunda wall closes an entrance');
});
test('staircase descends and ascends continuously; upper floor cannot fall through hole',()=>{
 const nav=createNavigation(config,makeLayout(config)),s=config.building.stair,r=(s.innerRadius+s.outerRadius)/2;
 let y=0;
 for(let a=0;a<=s.sweep;a+=.015){const next=nav.floorAt(Math.sin(a)*r,Math.cos(a)*r,y);assert.notEqual(next,null);assert(Math.abs(next-y)<=s.depth/(s.steps-1)+.001);y=next;}
 assert(Math.abs(y+s.depth)<.03);
 assert.equal(nav.floorAt(0,-4.4,y),-s.depth);
 for(let a=s.sweep;a>=0;a-=.015){const next=nav.floorAt(Math.sin(a)*r,Math.cos(a)*r,y);assert.notEqual(next,null);y=next;}
 assert(Math.abs(y)<.03);
 assert.equal(nav.floorAt(0,0,0),null);
 assert.equal(nav.floorAt(-2,0,0),null);
 assert.equal(nav.floorAt(0,3.05,0),0);
});
test('config supports renaming and different wing counts without geometry changes',()=>{
 for(const count of [5,8]){
  const c={...config,halls:Array.from({length:count},(_,i)=>({...config.halls[i%6],id:'hall-'+i,title:'Другая тема'}))};
  const l=makeLayout(c);assert.equal(l.halls.length,count);
  for(const h of l.halls){const p=l.world(h,0,h.start+10);assert(l.walkable(p.x,p.z));assert(l.walls.some(w=>w.hall===h.id));}
 }
});
test('movement substeps prevent passing through an exterior wall',()=>{
 const nav=createNavigation(config,makeLayout(config)),p={x:0,z:config.building.radius+10};
 for(let i=0;i<300;i++)nav.move(p,new Set(['d','shift']),0,.1,0);
 assert(p.x<config.building.wingWidth/2-.25);
});
test('local imports and every bundled asset resolve without CDN access',async()=>{
 const root=new URL('../',import.meta.url);
 async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())await walk(url);else if(entry.name.endsWith('.js')){const source=await fs.readFile(url,'utf8');for(const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g))await fs.access(new URL(match[1],url));}}}
 await walk(new URL('src/',root));
 for(const name of await fs.readdir(new URL('assets/',root)))await fs.access(new URL('assets/'+name,root));
 for(const name of ['hooded-crow.glb','afk-bird.glb']){
  const bytes=await fs.readFile(new URL('assets/birds/'+name,root));
  assert.equal(bytes.toString('utf8',0,4),'glTF');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert(gltf.animations.some(a=>['fly','Flap'].includes(a.name)));
 }
});

test('a hall awaiting curation remains walkable without a wall category',()=>{
 for(const walls of [undefined,[]]){
  const halls=config.halls.map((hall,i)=>i===0?{...hall,walls}:hall);
  const layout=makeLayout({...config,halls}),hall=layout.halls[0];
  const center=layout.world(hall,0,hall.start+5);
  assert(layout.walkable(center.x,center.z));
  assert(!layout.walls.some(wall=>wall.hall===hall.id));
 }
});
