import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('the Lair exposes the five transferred Atelier controls with a separate shuffle button', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/restoration-view.js', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../../../workshops/atelier/src/main.js', import.meta.url), 'utf8');
  for (const id of ['atelier-toon-enabled','atelier-ink-enabled','atelier-blur-enabled',
    'atelier-toon-bands','atelier-ink-width','atelier-blur-radius',
    'lair-easel-labels','lair-easel-camera-controls','lair-focus-exit',
    'gallery-shuffle','lair-wall-art-hover']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(main.includes('atelierFilter.render()'));
  assert.ok(view.includes('createCameraTransition'));
  assert.ok(source.includes('exhibition.viewedId()'));
  assert.ok(source.includes("shuffle: () => $('wall-gallery-shuffle').click()"));
  assert.ok(view.includes('atelierFilter?.setBlurSuspended(true)'));
  assert.ok(view.includes('atelierFilter?.setBlurSuspended(false)'));
});

test('the Lair defocuses its nearer wall without changing the standalone Atelier blur', () => {
  const filter = readFileSync(new URL('../../../workshops/atelier/src/effects/cartoon-filter.js', import.meta.url), 'utf8');
  const draw = readFileSync(new URL('../../../workshops/atelier/src/effects/drawing-shader.js', import.meta.url), 'utf8');
  const blur = readFileSync(new URL('../../../workshops/atelier/src/effects/background-blur-shader.js', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/visual-settings.js', import.meta.url), 'utf8');
  assert.match(filter, /backgroundBlurNear:\s*1\.1,\s*backgroundBlurFar:\s*2\.7/);
  assert.match(settings, /backgroundBlurNear:\s*\.25,\s*backgroundBlurFar:\s*1\.25/);
  for (const shader of [draw, blur]) {
    assert.match(shader, /uniform float uBlurNear;/);
    assert.match(shader, /uniform float uBlurFar;/);
    assert.match(shader, /smoothstep\(uBlurNear, uBlurFar, distance - uFocus\)/);
  }

  // In the shared room the wall is ~1.35 m farther than the two-easel target.
  const focus = new THREE.Vector3(1.56, 3.22, 10.35).distanceTo(new THREE.Vector3(-7.05, 2.48, 10.35));
  const rearWall = new THREE.Vector3(1.56, 3.22, 10.35).distanceTo(new THREE.Vector3(-8.40, 2.48, 10.35));
  const step = (start, end, value) => { const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1); return t * t * (3 - 2 * t); };
  assert.ok(step(1.1, 2.7, rearWall - focus) < .1);
  assert.ok(step(.25, 1.25, rearWall - focus) > .9);
});

test('the comparison stepper stays right of the centered workbench toggle and labels have no backplate', () => {
  const css = readFileSync(new URL('../src/original-stations.css', import.meta.url), 'utf8');
  assert.match(css, /\.lair-easel-camera-controls\s*\{[^}]*right:clamp\([^}]*left:auto;/);
  assert.match(css, /\.lair-easel-labels span\s*\{[^}]*background:transparent;/);
  assert.match(css, /\.lair-easel-camera-controls\s*\{[^}]*transform:none;/);
});
