import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWallArtworkPicker } from '../src/wall-artwork-picker.js';

test('camera-facing, visible screen area decides the gallery artwork without pointer input', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1.4, .1, 65);
  const artworks = new Map();
  const imageMeshes = [];
  for (const [id, x, width] of [['middle', 0, 2], ['side', 2.6, 2.8]]) {
    const image = new THREE.Mesh(new THREE.PlaneGeometry(width, 2), new THREE.MeshBasicMaterial());
    image.position.set(x, 0, -4.5);
    image.userData.galleryId = id;
    scene.add(image);
    artworks.set(id, { image, placement: { id, width, height: 2 } });
    imageMeshes.push(image);
  }
  const picker = createWallArtworkPicker({ THREE, camera, artworks, imageMeshes,
    renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } } });
  camera.position.set(0, 0, 1);
  camera.lookAt(0, 0, -4.5);
  assert.equal(picker.getProminentPainting()?.id, 'middle');
  assert.equal(picker.getProminentPainting(null, { minFrameFraction: .48 })?.id, 'middle');

  camera.position.set(0, 0, 9.5);
  camera.lookAt(0, 0, -4.5);
  assert.equal(picker.getProminentPainting(null, { minFrameFraction: .48 }), null,
    'a painting visible in the overall gallery is not yet a close-up');

  camera.position.set(2.6, 0, 1);
  camera.lookAt(2.6, 0, -4.5);
  assert.equal(picker.getProminentPainting('middle')?.id, 'side');

  camera.lookAt(2.6, 0, 10); // All paintings are behind the viewer now.
  assert.equal(picker.getProminentPainting('side'), null);
});

test('a centered close-up wins over a bigger peripheral artwork', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1.4, .1, 65);
  const artworks = new Map();
  const imageMeshes = [];
  for (const [id, x, width, height] of [
    ['center', 0, 1.9, 1.8],
    ['large-edge', 3.3, 3.9, 4],
  ]) {
    const image = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial());
    image.position.set(x, 0, -4.5);
    image.userData.galleryId = id;
    scene.add(image);
    artworks.set(id, { image, placement: { id, width, height } });
    imageMeshes.push(image);
  }
  const picker = createWallArtworkPicker({ THREE, camera, artworks, imageMeshes,
    renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } } });
  camera.position.set(0, 0, 1);
  camera.lookAt(0, 0, -4.5);

  assert.equal(picker.getProminentPainting(null, { minFrameFraction: .48 })?.id, 'center',
    'the picture under the crosshair remains selectable below the peripheral size threshold');
  assert.equal(picker.getProminentPainting('large-edge', { minFrameFraction: .48 })?.id, 'center',
    'an earlier selection cannot override a new picture directly under the center');
});
