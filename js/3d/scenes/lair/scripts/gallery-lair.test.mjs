import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createWallArtworkPicker } from '@keynlock/atelier/src/wall-artwork-picker.js';

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

test('gallery entry, separate camera controls and collapsible in-room Atelier are wired', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const transitions = readFileSync(new URL('../src/zone-transitions.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/restoration-view.js', import.meta.url), 'utf8');
  const atelier = readFileSync(new URL('../../../workshops/atelier/src/main.js', import.meta.url), 'utf8');
  const stylesheet = readFileSync(new URL('../src/original-stations.css', import.meta.url), 'utf8');
  for (const id of ['wall-collection-entry','lair-gallery-controls','gallery-prev',
    'gallery-next','gallery-easels','gallery-select']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(transitions.includes("const sourcePose = id === 'alchemy' ? rendererHost?.getWorldPose('alchemy') : null") &&
    transitions.includes('const stationPosition = sourcePose?.position.toArray() || zone.camera'),
    'restoration entry must keep its preset easel view rather than inheriting the wall gallery pose');
  assert.ok(view.includes("rendererHost.getWorldPose('restoration')"),
    'the room renderer must follow the real gallery camera');
  assert.ok(atelier.includes('window.__keynlockAtelierGallery'));
  assert.ok(atelier.includes('__keynlockLairGalleryActive'));
  assert.ok(stylesheet.includes('#atelier-embedded-app .workbench-toggle {display: flex !important'));
  assert.ok(stylesheet.includes('#atelier-embedded-app .workbench-content[hidden] {display: none !important}'));
  assert.ok(stylesheet.includes('height: auto;'));
});
