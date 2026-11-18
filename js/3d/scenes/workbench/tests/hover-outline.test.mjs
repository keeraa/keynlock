import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {createWideEdgeGeometry,createWideEdgeMaterial,
  fadeOutline} from '../public/js/lab/effects/hover-outline.js';

test('outline produces actual wide white triangle ribbons, not thin WebGL lines',()=>{
  const edges=new THREE.EdgesGeometry(new THREE.BoxGeometry(1,.3,.2));
  const ribbons=createWideEdgeGeometry(THREE,edges);
  const sourceSegments=edges.getAttribute('position').count/2;
  assert.equal(ribbons.getAttribute('position').count,sourceSegments*4);
  assert.equal(ribbons.index.count,sourceSegments*6);
  assert.deepEqual([...ribbons.getAttribute('edgeSide').array.slice(0,4)],
    [1,-1,1,-1]);
  const material=createWideEdgeMaterial(THREE,new THREE.Vector2(1200,800));
  assert.ok(material.vertexShader.includes('uWidth'));
  assert.ok(material.fragmentShader.includes('vec4(1.0,1.0,1.0'));
  assert.equal(material.uniforms.uWidth.value,4.5);
  assert.equal(fadeOutline(0,1,0),0);
  assert.ok(fadeOutline(0,1,.05)>0&&fadeOutline(0,1,.05)<1);
  assert.ok(fadeOutline(1,0,.05)<1);
  material.dispose();ribbons.dispose();edges.dispose();
});
