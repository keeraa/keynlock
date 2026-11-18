import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetricBoxGeometry } from '../dist/js/metric-box-geometry.js';

function uvSize(attribute, face) {
  const xs = [], ys = [];
  for (let i = face * 4; i < face * 4 + 4; i++) {
    xs.push(attribute.getX(i));
    ys.push(attribute.getY(i));
  }
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

test('slim vertical pilasters keep brush marks at the same physical scale', () => {
  const size = [.83, 10.8, .63];
  const tileMeters = 3.8;
  const geometry = createMetricBoxGeometry(size, tileMeters);
  const uv = geometry.getAttribute('uv');
  assert.equal(uv.count, 24);
  const [sideWidth, sideHeight] = uvSize(uv, 0);
  const [frontWidth, frontHeight] = uvSize(uv, 4);
  assert.ok(Math.abs(sideWidth - size[2] / tileMeters) < 1e-6);
  assert.ok(Math.abs(frontWidth - size[0] / tileMeters) < 1e-6);
  assert.ok(Math.abs(sideHeight - size[1] / tileMeters) < 1e-6);
  assert.ok(Math.abs(frontHeight - sideHeight) < 1e-6);
  geometry.dispose();
});

test('long narrow perimeter trim tiles along its length without squeezing its ends', () => {
  const geometry = createMetricBoxGeometry([.54, .29, 46.8], 2.6);
  const uv = geometry.getAttribute('uv');
  const [run, height] = uvSize(uv, 0);
  const [endWidth, endHeight] = uvSize(uv, 4);
  assert.ok(Math.abs(run - 46.8 / 2.6) < 1e-5);
  assert.ok(Math.abs(height - .29 / 2.6) < 1e-5);
  assert.ok(Math.abs(endWidth - .54 / 2.6) < 1e-5);
  assert.ok(Math.abs(endHeight - .29 / 2.6) < 1e-5);
  geometry.dispose();
});
