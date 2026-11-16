import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import {setInspectionWindowOpacity, SCHEMATIC_XRAY_TRANSPARENCY} from
  '../src/js/effects/inspection-window.js';

test('a fully visible inspection wall occludes hidden outlines in both render passes', () => {
  const wall=new THREE.MeshStandardMaterial({transparent:true,depthWrite:false,opacity:.22});
  const oldVersion=wall.version;
  setInspectionWindowOpacity(wall,1);
  assert.equal(wall.opacity,1);
  assert.equal(wall.transparent,false);
  assert.equal(wall.depthWrite,true);
  assert.ok(wall.version>oldVersion,'renderer switches to opaque depth-writing pipeline');
  const opaqueVersion=wall.version;
  setInspectionWindowOpacity(wall,1);
  assert.equal(wall.version,opaqueVersion,'no shader recompilation on consecutive frames');
  setInspectionWindowOpacity(wall,1-SCHEMATIC_XRAY_TRANSPARENCY);
  assert.equal(wall.opacity,.24);
  assert.equal(wall.transparent,true);
  assert.equal(wall.depthWrite,false);
  assert.equal(wall.version,opaqueVersion+1);
  wall.dispose();
});
