import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createPlayerController} from '../src/player/controller.js';
import {hiddenFloorFaces} from '../src/paintings/floor-drop.js';
import {createPaintingDisplay} from '../src/paintings/display.js';

const settings={frameWidthM:.05,frameDepthM:.05,loadRadiusM:15,maxLoaded:72};
const config={building:{floorElevation:8,wallBays:3},paintings:settings};
const atlas={columns:4,rows:4,cellSize:64,gutter:1,url:'atlas'};
const wall={id:'a/side/1',hall:'a'};
function work(id,z,width=1,height=1){
  const painting={id,physicalSizeM:{width,height},image:{widthPx:128,heightPx:128,overviewCell:1}};
  return {painting,x:0,y:1,z,width:width+.1,height,wall,normal:{x:1,z:0}};
}

test('flat walking keeps the eye level with uneven frame intervals and smooths a stair transition',()=>{
  const camera=new THREE.PerspectiveCamera(),nav={move:()=>({floorY:0,moving:true})};
  const player=createPlayerController({THREE,camera,navigation:nav,config});player.reset();
  const eye=camera.position.y;
  for(let i=0;i<90;i++){
    player.update(i%2?.008:.020,i,true);assert.equal(camera.position.y,eye);
  }
  nav.move=()=>({floorY:-.2,moving:true});player.update(.016,100,true);
  assert(camera.position.y<eye && camera.position.y>eye-.2);
});

test('only a touching upper frame covering the entire image hides the face',()=>{
  const base={...work('lower',0),floorAngle:.3,y:0};
  const cover={...work('upper',0,2,2),floorAngle:-.2,y:.05};
  assert(hiddenFloorFaces([base,cover],settings).has(base));
  for(const change of [{x:1},{y:.1},{floorRoom:'other'}]){
    assert(!hiddenFloorFaces([base,{...cover,...change}],settings).has(base));
  }
  assert.equal(hiddenFloorFaces([base],settings).size,0);
});

test('atlas culls whole bays, includes a large canvas crossing the view and reveals the atlas face after pickup',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(73,1,.05,200);
  const hall={id:'a',start:0,length:30},layout={halls:[hall],local:(_,x,z)=>({x,z})};
  const display=createPaintingDisplay({THREE,world:{scene,camera,layout},config,catalog:{overviewAtlas:atlas}});
  const mesh=scene.getObjectByName('painting-overview');
  camera.position.set(1,9,10);
  display.setSlots([work('front',1),work('behind',26)]);
  assert.equal(mesh.geometry.drawRange.count,42);
  // Canvas is parallel to the viewing direction, centered behind the eye but extends into view.
  display.setSlots([work('front',1),work('wide',15,22)]);
  assert.equal(mesh.geometry.drawRange.count===Infinity?mesh.geometry.index.count:mesh.geometry.drawRange.count,84);
  const lower={...work('base',1),y:0,floorAngle:0}, upper={...work('top',1,2,2),y:.05,floorAngle:0};
  display.setSlots([lower,upper]);assert.equal(mesh.geometry.index.count,78);
  display.setSlots([lower]);assert.equal(mesh.geometry.index.count,42);
  display.dispose();
});

test('a transient preview failure retries while the camera stays on the same painting',async t=>{
  let attempts=0,now=0;
  t.mock.method(performance,'now',()=>now);
  t.mock.method(console,'warn',()=>{});
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>{
    if(++attempts===1)throw Error('temporary');
    return new THREE.Texture();
  });
  const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),slot=work('retry',0);
  slot.painting.placement={hall:'a',wall:'side'};
  const display=createPaintingDisplay({THREE,world:{camera,scene},config,catalog:{imageUrl:()=>'/art'},onAim(){}});
  display.setSlots([slot]);
  async function tick(time){
    now=time;display.update(time,()=>slot);await new Promise(resolve=>setImmediate(resolve));
  }
  await tick(0);await tick(200);assert.equal(attempts,1);
  await tick(550);assert.equal(attempts,2);assert(scene.getObjectByName('canvas:retry'));
  await tick(1300);assert.equal(attempts,2);display.dispose();
});

test('moving one frame preserves the geometry and material of the other gallery',t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const display=createPaintingDisplay({THREE,world:{scene,camera},config,catalog:{overviewAtlas:atlas}});
  const a=work('a',1),b={...work('b',2),wall:{id:'b/end',hall:'b'}};
  display.setSlots([a,b],true);
  const [first,second]=scene.getObjectsByProperty('name','painting-overview');
  const before=second.geometry;
  assert.equal(first.material,second.material);
  display.setSlots([b],true,'a');
  assert.equal(second.geometry,before);assert.equal(second.geometry.index.count,42);
  assert(!first.visible);display.dispose();
});
