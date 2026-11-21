import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {FOUNDATION_SHADE,BUILDING_GHOST_RENDER_ORDER,createFoundationShadedMaterial,createPlacementRoadCutout}
  from '../js/path-builder/building-ground-contact.js';

const source=new THREE.MeshStandardMaterial({color:'#dbbc8f',roughness:1});
const material=createFoundationShadedMaterial(source);
assert.notEqual(material,source,'The editor must not tint shared materials from other scenes');
assert.equal(material.color.getHex(),source.color.getHex(),'Preserve the original gouache palette');
assert.ok(FOUNDATION_SHADE.strength>0&&FOUNDATION_SHADE.strength<.25,'Foundation pigment stays subtle');
const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,
  fragmentShader:THREE.ShaderLib.standard.fragmentShader};
material.onBeforeCompile(shader);
assert.match(shader.vertexShader,/vFoundationHeight = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.y - uFoundationBase/,
  'Height gradient must follow the actual foundation level on raised terrain');
assert.ok(shader.uniforms.uFoundationBase,'Foundation height is adjustable for a building on a hill');
assert.match(shader.fragmentShader,/smoothstep\(0\.040, 0\.760, vFoundationHeight\)/,
  'Bottom-to-top pigment must fade without a sharp horizontal edge');
assert.match(shader.fragmentShader,/gl_FragColor\.rgb \*= 1\.0 - 0\.170/);
assert.notEqual(material.customProgramCacheKey(),source.customProgramCacheKey(),
  'Tinted shader must not reuse a program compiled without the gradient');
for(const [type,original] of [
  ['basic',new THREE.MeshBasicMaterial()],
  ['physical',new THREE.MeshPhysicalMaterial()],
]){
  const tinted=createFoundationShadedMaterial(original);
  const program={vertexShader:THREE.ShaderLib[type].vertexShader,
    fragmentShader:THREE.ShaderLib[type].fragmentShader};
  tinted.onBeforeCompile(program);
  assert.match(program.fragmentShader,/vFoundationHeight/,
    `The bottom tint must compile for ${type} building surfaces`);
  tinted.dispose();original.dispose();
}

const cutout=createPlacementRoadCutout(THREE,20,14);
assert.equal(cutout.geometry.parameters.width,19.82);
assert.equal(cutout.geometry.parameters.height,13.82);
assert.equal(cutout.material.colorWrite,false,'The pavement occluder must remain invisible');
assert.equal(cutout.material.depthWrite,true,'The pavement must fail its depth test inside the footprint');
assert.ok(BUILDING_GHOST_RENDER_ORDER>2&&BUILDING_GHOST_RENDER_ORDER<5,
  'The preview must render above stone paths but below the selection outline');
assert.ok(cutout.position.y>.065&&cutout.position.y<.14,
  'Depth-only footprint sits above roads and below the placement ghost');
assert.equal(cutout.userData.noOutline,true,'The mask must not generate cartoon outlines');
cutout.geometry.dispose();cutout.material.dispose();material.dispose();source.dispose();
console.log('Building ground contact: shader fade and depth-only preview mask OK');
