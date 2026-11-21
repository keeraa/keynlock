import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCartoonFilter } from '../src/effects/cartoon-filter.js';

// Light beams and sunlit patches are drawn with transparent shaders whose
// opacity stays 1. In the outline's normal pass they would become solid
// planes and get their edges inked, so anything marked as atmosphere is skipped.
test('the outline pass skips atmosphere: dust, light beams and sunlit patches', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, 1.5, .1, 95);
  const solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ transparent: true }));
  beam.userData.atmosphere = true;
  const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  dust.userData.atmosphere = true;
  scene.add(solid, beam, dust);
  let target = null;
  const normalPass = [];
  const renderer = {
    getPixelRatio: () => 1, getRenderTarget: () => target, setRenderTarget: value => { target = value; },
    getClearColor: color => color.set(0), getClearAlpha: () => 1, setClearColor() {},
    info: { render: { triangles: 0, calls: 0 } },
    render: renderedScene => {
      if (renderedScene === scene && target?.texture && !target.depthTexture)
        normalPass.push({ solid: solid.visible, beam: beam.visible, dust: dust.visible });
    },
  };
  const filter = createCartoonFilter({ THREE, renderer, scene, camera });
  filter.resize(800, 500);
  filter.setOptions({ outline: true, outlineStrength: .7, toon: false, backgroundBlur: 0 });
  filter.render();
  assert.deepEqual(normalPass, [{ solid: true, beam: false, dust: false }]);
  assert.equal(beam.visible && dust.visible, true, 'atmosphere is shown again for the colour pass');
  filter.dispose();
});
