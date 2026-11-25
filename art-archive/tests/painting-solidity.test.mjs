import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {createPaintingObject} from '../catalog/three-painting.js';
import {overviewGeometry} from '../src/paintings/overview.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createNavigation} from '../src/player/movement.js';
import {createPlayerController} from '../src/player/controller.js';
import {PLAYER_DEFAULTS} from '../config/runtime.js';
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

test('atlas wooden faces sit strictly inside detail backing and rails on both sides, also face down',async()=>{
 const settings=config.paintings,depth=settings.frameDepthM,rim=settings.frameWidthM;
 const view=await createPaintingObject({THREE,painting,imageUrl:'preview',frameWidthM:rim,frameDepthM:depth,
   loader:{loadAsync:async()=>new THREE.Texture({width:300,height:200})}});
 const slot={painting,x:0,y:0,z:0,width:3+2*rim,height:2,normal:{x:0,z:1}};
 const distant=new THREE.Mesh(overviewGeometry(THREE,[slot],{columns:2,rows:2,cellSize:64,gutter:2},settings),new THREE.MeshBasicMaterial());
 for(const pitch of [0,Math.PI/2]){
  view.object.rotation.x=distant.rotation.x=pitch;
  view.object.updateMatrixWorld(true);distant.updateMatrixWorld(true);
  // Reverse canvas centre and both faces of a wooden rail used to overlap across LODs.
  for(const [x,side] of [[0,-1],[1.5+rim/2,-1],[1.5+rim/2,1]]){
   const from=new THREE.Vector3(x,0,side*2).applyEuler(distant.rotation);
   const dir=new THREE.Vector3(0,0,-side).applyEuler(distant.rotation);
   const ray=new THREE.Raycaster(from,dir);
   const detail=ray.intersectObject(view.object,true)[0],atlas=ray.intersectObject(distant)[0];
   assert(detail && atlas);assert(atlas.distance-detail.distance>.001,'LOD faces must not be coplanar');
  }
 }
 view.dispose();distant.geometry.dispose();distant.material.dispose();
});

test('the rear uses the same untiled board coordinates in the atlas and the detailed frame',async()=>{
 const rim=config.paintings.frameWidthM,depth=config.paintings.frameDepthM;
 const view=await createPaintingObject({THREE,painting,imageUrl:'preview',frameWidthM:rim,frameDepthM:depth,gouache:{apply(){}},
  loader:{loadAsync:async()=>new THREE.Texture({width:300,height:200})}});
 const slot={painting,x:0,y:0,z:0,width:3+2*rim,height:2,normal:{x:0,z:1}};
 const geometry=overviewGeometry(THREE,[slot],{columns:2,rows:2,cellSize:64,gutter:2},config.paintings);
 for(const mesh of [view.object.getObjectByName('painting-back:solid'),view.object.getObjectByName('frame:solid'),{geometry}]){
  const {position,archiveBack}=mesh.geometry.attributes;
  let rear=0;
  for(let i=0;i<position.count;i++){
   if(archiveBack.getZ(i)!==1)continue;
   rear++;
   assert(Math.abs(archiveBack.getX(i)-(.5+position.getX(i)/(3+2*rim)))<.0001);
   assert(Math.abs(archiveBack.getY(i)-(.5+position.getY(i)/(2+2*rim)))<.0001);
  }
  assert(rear>0);
 }
 view.dispose();geometry.dispose();
});


test('disabling sprint makes a held Shift move at the ordinary walking speed',()=>{
 const layout=makeLayout(config),nav=createNavigation(config,layout),hall=layout.halls[0];
 const start=layout.world(hall,0,hall.start+6),held=new Set(['w','shift']);
 const walk={...start},locked={...start},sprint={...start};
 const yaw=Math.atan2(Math.sin(hall.angle),Math.cos(hall.angle));
 nav.move(walk,new Set(['w']),yaw,.04,0);
 nav.move(locked,held,yaw,.04,0,false);
 nav.move(sprint,held,yaw,.04,0);
 assert.deepEqual(locked,walk);
 assert(Math.hypot(sprint.x-start.x,sprint.z-start.z)>Math.hypot(walk.x-start.x,walk.z-start.z));
});


test('starting and resuming after the exhibition changes keeps the player outside trolley paintings',()=>{
 const layout=makeLayout(config),navigation=createNavigation(config,layout),camera=new THREE.PerspectiveCamera();
 const player=createPlayerController({THREE,camera,navigation,config});
 const spawn=PLAYER_DEFAULTS.spawn;
 const obstacle={...spawn,painting,width:3.1,height:2,y:1.32,normal:{x:0,z:1},trolley:true};
 navigation.setPaintingObstacles([obstacle]);
 player.reset();player.prepareView();player.update(0,0,false);
 assert(Math.hypot(camera.position.x-spawn.x,camera.position.z-spawn.z)>.85);
 const intro=camera.position.clone();
 player.update(0,1,true);
 assert(camera.position.equals(intro),'the intro and first playable frame use the same safe camera position');
 const free=navigation.safePosition(camera.position.x,camera.position.z,0);
 assert.equal(free.x,camera.position.x);assert.equal(free.z,camera.position.z);
 navigation.setPaintingObstacles([{...obstacle,x:free.x,z:free.z,normal:{x:1,z:0}}]);
 player.update(0,16,true);
 assert(Math.hypot(camera.position.x-free.x,camera.position.z-free.z)>.28);
 const start=camera.position.clone();
 player.held.add('d');player.update(.04,32,true);
 assert(camera.position.distanceTo(start)>.1);
});
