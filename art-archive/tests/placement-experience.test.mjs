import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {createPlacementPreview} from '../src/paintings/placement-preview.js';
import {createPlacementFeedback} from '../src/paintings/placement-feedback.js';
import {createFrameMotion} from '../src/paintings/frame-motion.js';
import {makeLayout} from '../src/architecture/layout.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config),fy=config.building.floorElevation;
const slot={painting:{id:'preview-test',physicalSizeM:{width:.8,height:1},image:{}},width:.935,height:1,destination:'world/life',wall:{hall:'world'},normal:{x:0,z:1},x:0,y:1,z:20};

test('wall and table previews share the framed, slowly pulsing dashed ghost with the same invalid tint',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();
 const motion=createFrameMotion(THREE,config,layout),preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);
 preview.select(slot);const wall={a:{x:0,z:20},b:{x:8,z:20},length:8,normal:{x:0,z:-1}};
 preview.wall(slot,wall,3,2,true,false,1000);
 const ghost=scene.getObjectByName('table-placement-preview'),dash=scene.getObjectByName('table-placement-outline');
 assert(ghost.visible);assert.equal(dash.material.color.getHex(),0xffe5a3);assert(dash.material.opacity>.75);
 const geometry=dash.geometry,opacity=dash.material.opacity;
 preview.wall(slot,wall,3,2,false,false,1800);assert.equal(dash.geometry,geometry);assert.equal(dash.material.color.getHex(),0xff3939);assert.notEqual(dash.material.opacity,opacity);
 preview.hide();preview.table({...slot,floorAngle:0,y:1},2000,true);assert.equal(dash.geometry,geometry);assert.equal(dash.material.color.getHex(),0xffe5a3);
 preview.dispose();assert.equal(scene.children.length,0);
});

test('a collision recovery that stays blocked never triggers the failed-pickup timeout',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();camera.position.set(0,fy+1.78,20);
 let blocked=false,routeBlocked=false;
 const motion={pose:s=>({position:new THREE.Vector3(s.x,fy+s.y,s.z),quaternion:new THREE.Quaternion()}),blocked:()=>false,advance:()=>blocked?0:1,route:(s,from,to)=>routeBlocked?null:[{position:from.position.clone(),quaternion:from.quaternion.clone()},to]};
 const preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);preview.select(slot);preview.beginLift(slot,0);
 const eye=new THREE.Vector3(0,1.78,20),dir=new THREE.Vector3(0,0,-1);
 for(let now=0;now<=700;now+=16)preview.follow(slot,false,null,eye,dir,slot,now,false);
 assert(!preview.takeLiftFailure());blocked=routeBlocked=true;
 for(let now=720;now<3000;now+=16){preview.follow(slot,false,null,eye,dir,slot,now,false);assert(!preview.takeLiftFailure(),'an already held painting must remain held at an obstruction');}
 assert(scene.getObjectByName('carried-painting').visible);preview.dispose();
});

test('table placement turns flat before crossing the table without a diagonal-radius lift above the destination',()=>{
 const motion=createFrameMotion(THREE,config,layout),table=layout.storageTables[0],n={x:Math.sin(table.angle),z:Math.cos(table.angle)};
 const target={...slot,x:table.x,z:table.z,y:table.y+.025,floorAngle:table.angle,supportId:table.id};
 const from={position:new THREE.Vector3(table.x+n.x*2,fy+1.1,table.z+n.z*2),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-.58,table.angle,0,'YXZ'))};
 const path=motion.route(slot,from,motion.pose(target),{lowArc:true});assert(path);
 assert(Math.max(...path.map(p=>p.position.y))<=fy+1.15,'placement must stay near hand/table height');
 for(let i=1;i<path.length;i++)assert.equal(motion.advance(slot,path[i-1],path[i]),1);
});

test('success smoke starts around all four sides, disperses briefly, then costs no visible draw call',()=>{
 const scene=new THREE.Scene(),feedback=createPlacementFeedback(THREE,scene,config);feedback.show(slot,1000);
 const smoke=scene.getObjectByName('placement-success');assert(smoke.isPoints&&smoke.visible);assert.equal(smoke.geometry.attributes.position.count,80);
 const p=smoke.geometry.attributes.position;let left=false,right=false,top=false,bottom=false;
 for(let i=0;i<p.count;i++){left||=p.getX(i)<-.46;right||=p.getX(i)>.46;top||=p.getY(i)>.55;bottom||=p.getY(i)<-.55;}
 assert(left&&right&&top&&bottom);assert.equal(smoke.material.depthWrite,false);
 feedback.update(1500);assert(smoke.visible);feedback.update(2100);assert(!smoke.visible);
 feedback.dispose();assert.equal(scene.children.length,0);
});
