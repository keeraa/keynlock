import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {attachWaterbedCutout,attachOpaqueWaterSurface,WATER_CUTOUT_THRESHOLD} from '../js/path-builder/water-bed-cutout.js';
import {KEYNLOCK_WATER_LEVEL,KEYNLOCK_REFERENCE_WATER_BED} from '../js/path-builder/keynlock-geography.js';

assert.ok(KEYNLOCK_WATER_LEVEL<=-1&&
  KEYNLOCK_REFERENCE_WATER_BED>-KEYNLOCK_WATER_LEVEL+1,
  'The fixed water surface is recessed and the river floor remains submerged');
const waterMask=new THREE.Texture();
const material=new THREE.MeshStandardMaterial({map:new THREE.Texture()});
attachWaterbedCutout(material,waterMask);
const shader={uniforms:{},fragmentShader:'void main() {\n#include <map_fragment>\n}'};
material.onBeforeCompile(shader);
assert.equal(shader.uniforms.uKeynlockWaterMask.value,waterMask,
  'Ground and water use the same alpha mask texture');
assert.ok(shader.fragmentShader.includes('texture2D(uKeynlockWaterMask, vMapUv).a'),
  'Every water pixel clips overlapping low-resolution land triangles');
assert.ok(shader.fragmentShader.includes(`> ${WATER_CUTOUT_THRESHOLD}) discard`));
assert.ok(material.customProgramCacheKey().includes('waterbed-cutout'));
const waterMaterial=new THREE.MeshBasicMaterial({map:waterMask,transparent:true,depthWrite:false});
attachOpaqueWaterSurface(waterMaterial);
const waterShader={uniforms:{},fragmentShader:'void main() {\n#include <map_fragment>\n}'};
waterMaterial.onBeforeCompile(waterShader);
assert.ok(waterShader.fragmentShader.includes(`a > ${WATER_CUTOUT_THRESHOLD} ? 1.0 : 0.0`),
  'The exposed river has fully opaque pixels wherever ground has been removed');
assert.equal(waterMaterial.transparent,false,'Opaque water no longer blends with sky through banks');
assert.equal(waterMaterial.depthWrite,true,'River occludes only the objects below water level');
assert.equal(waterMaterial.alphaTest,.5);
assert.ok(waterMaterial.customProgramCacheKey().includes('opaque-water'));
waterMaterial.dispose();
material.dispose();waterMask.dispose();
console.log('Deep water: shared shader cutout prevents shoreline triangles breaking rivers');
