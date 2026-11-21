import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCameraFraming } from '@keynlock/atelier/src/navigation/camera-framing.js';
import { createCartoonFilter } from '@keynlock/atelier/src/effects/cartoon-filter.js';

test('in-room easel close-ups use the original framing with the easel depth offset', () => {
  const camera = new THREE.PerspectiveCamera(39, 16 / 9, .1, 65);
  camera.position.set(0, 2.27, 4.4);
  const controls = { target: new THREE.Vector3(0, 1.87, -3.25),
    minPolarAngle: 1.23, maxPolarAngle: 1.67 };
  const framing = createCameraFraming({ THREE, camera, controls, easelX: 1.28,
    getPaintingCenterY: () => 1.91, getWallBounds: () => ({ width: 30, minY: 3, maxY: 12 }),
    easelOffsetZ: -3.25 });
  const original = framing.easelFocus('original');
  const restoration = framing.easelFocus('copy');
  assert.equal(original.target.x, -1.28);
  assert.equal(restoration.target.x, 1.28);
  assert.ok(Math.abs(original.target.z + 2.86) < 1e-9);
  assert.ok(Math.abs(restoration.position.z - 1.18) < 1e-9);
  const overview = framing.easelOverview();
  assert.equal(overview.target.z, -3.25);
  assert.ok(overview.position.z > restoration.position.z);
});

test('Atelier cartoon filter can post-process the real room renderer and restore the direct path', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, 1.5, .1, 95);
  const surfaces = [];
  let currentTarget = null;
  const renderer = {
    getPixelRatio: () => 1.5,
    getRenderTarget: () => currentTarget,
    setRenderTarget: value => { currentTarget = value; },
    info: { render: { triangles: 43, calls: 1 } },
    render: (renderedScene) => {
      surfaces.push(renderedScene === scene ? 'room' : 'postprocess');
      renderer.info.render.triangles = renderedScene === scene ? 43 : 2;
    },
  };
  const filter = createCartoonFilter({ THREE, renderer, scene, camera });
  filter.resize(800, 500);
  filter.setOptions({ toon: true, toonStrength: .8, bands: 4,
    outline: false, backgroundBlur: .72, backgroundRadius: 6.5 });
  const frame = filter.render();
  assert.deepEqual(surfaces, ['room', 'postprocess', 'postprocess', 'postprocess']);
  assert.equal(frame.sceneTriangles, 43);
  assert.equal(renderer.getRenderTarget(), null);
  filter.setBlurSuspended(true);
  const galleryFrame = filter.render();
  assert.deepEqual(surfaces.slice(-2), ['room', 'postprocess']);
  assert.equal(galleryFrame.calls, frame.calls - 2, 'gallery omits both blur passes');
  // Moving the visual slider while the wall gallery is open cannot turn blur back on.
  filter.setOptions({ backgroundBlur: .96, backgroundRadius: 13 });
  filter.render();
  assert.deepEqual(surfaces.slice(-2), ['room', 'postprocess']);
  filter.setBlurSuspended(false);
  const easelFrame = filter.render();
  assert.deepEqual(surfaces.slice(-4), ['room', 'postprocess', 'postprocess', 'postprocess']);
  assert.equal(easelFrame.calls, frame.calls, 'returning to easels restores the saved blur');
  filter.setOptions({ toon: false, outline: false, backgroundBlur: 0 });
  filter.render();
  assert.equal(surfaces.at(-1), 'room');
  assert.equal(surfaces.length, 13);
  filter.dispose();
});
