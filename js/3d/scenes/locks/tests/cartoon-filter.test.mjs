import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createCartoonFilter } from '../src/js/effects/cartoon-filter.js';
import {setInspectionWindowOpacity} from '../src/js/effects/inspection-window.js';
import { drawingFragmentShader } from '../src/js/effects/drawing-shader.js';
import { readFileSync } from 'node:fs';

test('drawing shader avoids Three.js built-in GLSL function name collisions', () => {
  const threeSource = readFileSync(new URL('../src/vendor/three.js', import.meta.url), 'utf8');
  assert.match(threeSource, /'float luminance\( const in vec3 rgb \) \{/);
  assert.doesNotMatch(drawingFragmentShader, /\bfloat\s+luminance\s*\(/);
  assert.match(drawingFragmentShader, /float inkLuma\(/);
});

test('painterly shader retains soft light bands and selective ink edges without paper noise', () => {
  assert.match(drawingFragmentShader, /float paintedBand\(/);
  assert.match(drawingFragmentShader, /smoothstep\(\.36, \.64, fract\(position\)\)/);
  assert.match(drawingFragmentShader, /float nearSide/);
  assert.match(drawingFragmentShader, /smoothstep\(\.23, \.67, length\(centerN\.rgb/);
  assert.doesNotMatch(drawingFragmentShader, /uPaper|paperNoise|paperFibers/);
  assert.match(drawingFragmentShader, /vec3 coolShadow/);
  assert.match(drawingFragmentShader, /vec3 warmLight/);
  assert.ok(!drawingFragmentShader.includes('discard'),
    'toon shading and ink must preserve transparent scene compositing');
});

test('drawing layers render independently, preserve scene statistics and allocate contours on demand', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, .08, 100);
  const translucentPart = new THREE.Mesh(new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: .35 }));
  scene.add(translucentPart);
  const inspectionWall=new THREE.Mesh(new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({transparent:true,depthWrite:false,opacity:.3}));
  scene.add(inspectionWall);
  const snow=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial());
  snow.userData.atmosphere=true;
  scene.add(snow);
  const drawn = [];
  let activeTarget = null;
  const renderer = {
    info: { render: { calls: 0, triangles: 0 } },
    getPixelRatio: () => 1.5,
    getRenderTarget: () => activeTarget,
    setRenderTarget(value) { activeTarget = value; },
    render(input, view) {
      drawn.push({ input, view, target: activeTarget, override: scene.overrideMaterial,
        transparentVisible: translucentPart.visible, wallVisible:inspectionWall.visible,
        snowVisible:snow.visible });
      this.info.render = input === scene ? { calls: 8, triangles: 600 } :
        { calls: 1, triangles: 2 };
    },
  };
  const filter = createCartoonFilter({ THREE, renderer, scene, camera });
  filter.resize(640, 480);
  assert.deepEqual(filter.render(), { calls: 8, triangles: 600 });
  assert.equal(drawn.length, 1, 'no extra render passes by default');

  // The cel-only layer uses color, then a screen quad; no normal pass.
  filter.setOptions({ toon: true, toonStrength: .85, bands: 5 });
  assert.deepEqual(filter.render(),
    { calls: 9, triangles: 602, sceneTriangles: 600 });
  assert.equal(drawn.length, 3);
  const colorTarget = drawn[1].target;
  assert.ok(colorTarget.isWebGLRenderTarget);
  assert.ok(colorTarget.depthTexture.isDepthTexture);
  assert.equal(colorTarget.width, 960);
  assert.equal(colorTarget.height, 720);
  assert.equal(drawn[2].target, null);
  const quad = drawn[2].input.children[0];
  const uniforms = quad.material.uniforms;
  assert.equal(uniforms.uToon.value, .85);
  assert.equal(uniforms.uBands.value, 5);
  assert.equal(uniforms.uOutline.value, 0);
  assert.equal(uniforms.uOutlineWidth.value, 1);
  assert.ok(quad.material.fragmentShader.includes('eyeDepth'));
  assert.ok(quad.material.fragmentShader.includes('tNormal'));
  assert.ok(!quad.material.fragmentShader.includes('paperNoise'));
  assert.ok(quad.material.fragmentShader.includes('tonemapping_fragment'));

  // Outlines use depth plus scene normals to catch contacting geometry.
  setInspectionWindowOpacity(inspectionWall.material,1);
  filter.setOptions({ outline: true, outlineStrength: .7, outlineWidth: 2.5 });
  const frame = filter.render();
  assert.deepEqual(frame, { calls: 17, triangles: 1202, sceneTriangles: 600 });
  assert.equal(drawn.length, 6);
  assert.equal(drawn[3].target, colorTarget);
  assert.equal(drawn[4].input, scene);
  assert.ok(drawn[4].target.isWebGLRenderTarget);
  assert.notEqual(drawn[4].target, colorTarget);
  assert.ok(drawn[4].override.isMeshNormalMaterial);
  assert.equal(drawn[4].transparentVisible, false);
  assert.equal(drawn[4].wallVisible,true,
    'the opaque front wall participates in the normal buffer and hides rear lines');
  assert.equal(drawn[4].snowVisible,false,
    'flying dust does not produce outlines on top of mechanical edges');
  assert.equal(translucentPart.visible, true, 'transparent mesh visibility restored');
  assert.equal(snow.visible,true,'the floating particles return to the color pass');
  assert.equal(scene.overrideMaterial, null);
  assert.equal(uniforms.tNormal.value, drawn[4].target.texture);
  assert.equal(uniforms.uOutline.value, .7);
  assert.equal(uniforms.uOutlineWidth.value, 2.5);
  assert.equal(activeTarget, null, 'original framebuffer restored');

  filter.resize(320, 200, 2);
  assert.equal(colorTarget.width, 640);
  assert.equal(colorTarget.height, 400);
  assert.equal(drawn[4].target.width, 640);
  assert.equal(drawn[4].target.height, 400);
  assert.ok(Math.abs(uniforms.uTexel.value.x - 1 / 640) < 1e-10);

  filter.setOptions({ outline: false });
  assert.equal(uniforms.uOutline.value, 0);
  assert.equal(uniforms.tNormal.value, colorTarget.texture, 'unused normal buffer released');
  assert.deepEqual(filter.render(),
    { calls: 9, triangles: 602, sceneTriangles: 600 });
  assert.equal(drawn.length, 8);
  filter.setOptions({ toon: false });
  assert.deepEqual(filter.render(), { calls: 8, triangles: 600 });
  assert.equal(drawn.length, 9);
  filter.setOptions({ toon: true });
  filter.render();
  assert.notEqual(drawn[9].target, colorTarget, 'old color target released on disable');
  filter.dispose();
  translucentPart.geometry.dispose();
  translucentPart.material.dispose();
  inspectionWall.geometry.dispose();
  inspectionWall.material.dispose();
  snow.geometry.dispose();
  snow.material.dispose();
});

test('legacy master controls can switch the independent layers together', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const renderer = { getPixelRatio: () => 1,
    getRenderTarget: () => null, setRenderTarget() {},
    info: { render: { calls: 0, triangles: 0 } }, render() {} };
  const filter = createCartoonFilter({ THREE, renderer, scene, camera });
  filter.setOutline(.9);
  filter.setEnabled(true);
  filter.render();
  filter.setEnabled(false);
  filter.render();
  filter.dispose();
});
