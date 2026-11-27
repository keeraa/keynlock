import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {createPaintingObject} from '../catalog/three-painting.js';
import {overviewGeometry} from '../src/paintings/overview.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createNavigation} from '../src/player/movement.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url)));
const painting={id:'solid',placement:{hall:'nature'},physicalSizeM:{width:3,height:2},image:{widthPx:300,heightPx:200,overviewCell:1}};

test('both detailed and distant paintings have an opaque reverse without showing the image backwards',async()=>{
 const view=await createPaintingObject({THREE,painting,imageUrl:'preview',loader:{loadAsync:async()=>new THREE.Texture({width:300,height:200})}});
 const slot={painting,x:0,y:0,z:0,width:3+2*config.paintings.frameWidthM,height:2,normal:{x:0,z:1}};
 const distant=new THREE.Mesh(overviewGeometry(THREE,[slot],{columns:2,rows:2,cellSize:64,gutter:2},config.paintings),new THREE.MeshBasicMaterial());
 view.object.updateMatrixWorld(true);distant.updateMatrixWorld(true);
 for(const object of [view.object,distant]){
  const ray=new THREE.Raycaster(new THREE.Vector3(0,0,-2),new THREE.Vector3(0,0,1));
  const hit=ray.intersectObject(object,true)[0];assert(hit,'no opaque reverse');
  assert(hit.point.z<0,'reverse must be behind the canvas');
  assert(!hit.object.material.transparent);assert(!hit.object.material.map,'reverse must not show the reproduction');
 }
 view.dispose();distant.geometry.dispose();distant.material.dispose();
});

test('walking and sprinting cannot cross either side of an upright painting, but clearing the painting restores passage',()=>{
 const layout=makeLayout(config),nav=createNavigation(config,layout),hall=layout.halls[0];
 const center=layout.world(hall,0,hall.start+8);
 const slot={...center,painting,width:3.1,height:2,y:1.4,normal:{x:0,z:1}};
 nav.setPaintingObstacles([slot]);
 for(const [offset,yaw] of [[2,0],[-2,Math.PI]]){
  const p={x:center.x,z:center.z+offset};
  for(let i=0;i<120;i++)nav.move(p,new Set(['w','shift']),yaw,.1,0);
  assert(offset>0?p.z>center.z+.29:p.z<center.z-.29);
 }
 // Slide along the frame, go around its end and continue; no invisible whole-room barrier.
 const p={x:center.x+2,z:center.z+2};
 for(let i=0;i<25;i++)nav.move(p,new Set(['w']),0,.04,0);
 assert(p.z<center.z);
 nav.setPaintingObstacles([]);
 const free={x:center.x,z:center.z+2};
 for(let i=0;i<25;i++)nav.move(free,new Set(['w']),0,.04,0);
 assert(free.z<center.z);
});
