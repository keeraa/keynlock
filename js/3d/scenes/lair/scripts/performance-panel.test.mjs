import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getTriangleBreakdown } from '../src/ui/performance-panel.js';
import { t } from '../src/i18n.js';

test('the triangle breakdown names workshops and room parts, largest first', () => {
  const scene = new THREE.Scene();
  const mesh = (segments, name = '') => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, segments, segments), new THREE.MeshBasicMaterial());
    m.name = name;
    return m;
  };
  // A workshop in the shared world, with a named part.
  const atelier = new THREE.Group(); atelier.name = 'keynlock-world-atelier:main';
  const wall = new THREE.Group(); wall.name = 'rear-wall-paintings';
  wall.add(mesh(40), mesh(40));
  atelier.add(wall);
  // The room: a named group, an unnamed mesh, and things that must not count.
  const window = new THREE.Group(); window.name = 'main-arched-window';
  window.add(mesh(12));
  const loose = mesh(6);
  const hidden = new THREE.Group(); hidden.visible = false; hidden.add(mesh(60, 'hidden'));
  const beam = mesh(30, 'beam'); beam.userData.atmosphere = true;
  scene.add(atelier, window, loose, hidden, beam);

  const { total, groups } = getTriangleBreakdown(scene);
  const triangles = segments => new THREE.SphereGeometry(1, segments, segments).index.count / 3;
  assert.equal(total, 2 * triangles(40) + triangles(12) + triangles(6), 'hidden meshes and light effects are left out');
  assert.equal(groups[0].label, `${t('Ателье')} · rear-wall-paintings`);
  assert.equal(groups[0].triangles, 2 * triangles(40));
  assert.equal(groups[1].label, `${t('Комната')} · main-arched-window`);
  assert.equal(groups[2].label, `${t('Комната')} · SphereGeometry`, 'unnamed meshes go by their geometry type');
  assert.ok(groups.every((group, i) => i === 0 || groups[i - 1].triangles >= group.triangles), 'largest first');
});
