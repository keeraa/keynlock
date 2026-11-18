import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {createClothSimulation} from '../public/js/lab/effects/cloth-simulation.js';

test('physical rag uses linked particles and retains the central grip',()=>{
  const geometry=new THREE.PlaneGeometry(.8,.58,16,12);
  const solver=createClothSimulation({THREE,geometry,columns:16,rows:12});
  assert.equal(solver.particleCount,221);
  assert.ok(solver.constraintCount>600);
  for(let i=0;i<120;i++)solver.update(1/60,{velocityX:1.2,velocityY:-.6,contact:true,held:true});
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    assert.ok(Number.isFinite(position.getX(i))&&Number.isFinite(position.getZ(i)));
    assert.ok(position.getZ(i)>=-.053,'cloth cannot pass through lock');
  }
  assert.ok(position.getZ(0)<position.getZ(110),'edge sags below gripped center');
  geometry.dispose();
});
