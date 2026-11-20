import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import {
  installKeyAssetProvider, createCombinedKeyGeometry, createKeyModel,
  getKeyDisplayScale, getKeyProviderName,
} from '../dist/js/key-factory.js';

test('a constructor adapter can supply assets before first scene use', () => {
  assert.throws(() => installKeyAssetProvider({}), /requires/);
  const geometry = new THREE.BoxGeometry(1, 2, .1);
  const adapter = {
    createModel: () => new THREE.Group(),
    getGeometry: () => geometry,
    createGlyph: () => new THREE.Group(),
    getPaint: () => null,
    getMetal: () => 'steel',
    getColliderSize: () => [.5, .2, .7],
    getDisplayScale: () => .3,
    createFallbackStamp: () => null,
  };
  installKeyAssetProvider(adapter);
  assert.equal(getKeyProviderName(), 'external');
  assert.equal(createCombinedKeyGeometry(0), geometry);
  assert.ok(createKeyModel(0).isGroup);
  assert.equal(getKeyDisplayScale('bath', 0), .3);
  assert.throws(() => installKeyAssetProvider(adapter), /before the archive scene/);
});
