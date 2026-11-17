import assert from 'node:assert/strict';
import * as T from '../vendor/three.js';
import {acquireHouseAtmosphereResources} from '../modules/house-builder/core/house-atmosphere.js';
import {createBuildingSmokeBatch} from '../modules/house-builder/core/building-smoke-batch.js';

const resources=acquireHouseAtmosphereResources(T);
const puffs=[
  {x:2,y:8,z:-4,phase:0,seed:0},
  {x:2,y:8,z:-4,phase:1/3,seed:1},
  {x:2,y:8,z:-4,phase:2/3,seed:2},
];
const batch=createBuildingSmokeBatch(T,puffs,{resources,pointScale:900,nearDistance:110});
assert(batch.points.isPoints&&batch.points.material.isShaderMaterial);
assert.equal(batch.points.geometry.getAttribute('position').count,3);
assert.equal(batch.points.material.uniforms.puffMap.value,resources.smokeMaps[1]);
batch.update(0);
const positions=batch.points.geometry.getAttribute('position');
const sizes=batch.points.geometry.getAttribute('puffSize');
const opacity=batch.points.geometry.getAttribute('color');
const start=positions.getY(0),size=sizes.getX(0);
assert(start<8&&opacity.getW(0)>.8,'Smoke must be visible inside its outlet');
batch.update(5,new T.Vector3(2,7,-4));
assert(positions.getY(0)>start+3&&sizes.getX(0)>size*3);
batch.update(5,new T.Vector3(1000,1000,1000));
assert.equal(opacity.getW(0),0,'Distant smoke should be culled within the batch');
batch.setSettings({smokeOutline:false,smokeDensity:35,night:true});
assert.equal(batch.points.material.uniforms.puffMap.value,resources.smokeMaps[0]);
assert.equal(batch.points.material.uniforms.density.value,.35);
batch.setSettings({smoke:false});
assert.equal(batch.points.visible,false);
batch.dispose();batch.dispose();resources.release();
console.log('Shared smoke renderer: one draw, slow rise, settings, distance culling and disposal OK');
