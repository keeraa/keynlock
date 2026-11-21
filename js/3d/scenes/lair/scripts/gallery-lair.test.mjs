import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWallArtworkPicker } from '../../../workshops/atelier/src/wall-artwork-picker.js';

test('in-room gallery picks paintings using the visible Lair pointer area', () => {
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 20);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
  painting.userData.galleryId = 'painting-one';
  painting.updateMatrixWorld();
  const art = { id: 'painting-one', title: 'Test painting' };
  const picker = createWallArtworkPicker({
    THREE, camera, renderer: { domElement: { getBoundingClientRect: () => ({ width: 0, height: 0 }) } },
    pointerElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) },
    artworks: new Map([['painting-one', { placement: art }]]), imageMeshes: [painting],
  });
  assert.equal(picker.hitTest({ clientX: 200, clientY: 150 }), art);
  assert.equal(picker.hitTest({ clientX: 0, clientY: 0 }), null);
  painting.geometry.dispose();
  painting.material.dispose();
});
