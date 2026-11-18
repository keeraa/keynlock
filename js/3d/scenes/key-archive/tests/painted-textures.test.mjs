import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAINTED_METALS, METAL_BY_KEY_TYPE } from '../dist/js/painted-textures.js';

test('original Keynlock painted textures are packaged for all ten key families', () => {
  assert.equal(METAL_BY_KEY_TYPE.length, 10);
  for (const metal of METAL_BY_KEY_TYPE) assert.ok(PAINTED_METALS[metal]);
  for (const texture of Object.values(PAINTED_METALS)) {
    const path = fileURLToPath(new URL(`../dist/${texture.replace(/^\.\//, '')}`, import.meta.url));
    assert.ok(existsSync(path), `missing ${texture}`);
    assert.ok(statSync(path).size > 1000, `empty ${texture}`);
  }
});
