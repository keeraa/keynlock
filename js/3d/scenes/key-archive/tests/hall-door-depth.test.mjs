import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('entrance door has two framed wooden leaves and brass handles', () => {
  const architecture = readFileSync(new URL('../dist/js/world-architecture.js', import.meta.url), 'utf8');
  assert.match(architecture, /function addEntranceDoor\(scene, mat\)/);
  assert.match(architecture, /const z = 22\.94/);
  assert.match(architecture, /for \(const side of \[-1, 1\]\)/);
  assert.match(architecture, /new THREE\.TorusGeometry\(\.13, \.035, 8, 20\)/);
  assert.match(architecture, /addEntranceDoor\(scene, mat\)/);
});

test('distance blur uses original camera depth to keep close objects sharp', () => {
  const painter = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  const shader = readFileSync(new URL('../dist/js/painted-shader.js', import.meta.url), 'utf8');
  assert.match(painter, /distanceBlur: \{ \.\.\.makePass\(createDistanceBlurShader\)/);
  assert.match(painter, /blur\.tDepth\.value = sceneTarget\.depthTexture/);
  assert.match(shader, /smoothstep\(20\.0, 45\.0, distance\)/);
  assert.match(shader, /mix\(sharp, soft, blur\)/);
});
