// @ts-check
import * as THREE from '../vendor/three.js';
import { CANDLE_WICK_Y, CANDLE_FLAME_HEIGHT } from './archive-candles.js';
import { getKeyCoatLayout, buildKeyCoatGeometry, getKeyCoatPoint } from './key-factory.js';
import { meltWaxBlobs } from './key-wax.js';

// Wax melting on the held key over a candle. Heat builds up only on the wax
// right above the flame, so that pool melts while the rest waits its turn;
// beads drip into the flame from the pool that is melting. progress 0
// restores the full coat.
export function createHeldWaxMelt({ candles, cleaningEffects, keyIndex, sceneNow }) {
  const melt = { keyId: null, geometry: null };
  let waxBeadAt = 0;

  function release(crust) {
    if (melt.geometry && crust?.geometry === melt.geometry) crust.geometry = crust.userData.fullCoat;
    melt.geometry?.dispose();
    Object.assign(melt, { keyId: null, geometry: null });
  }

  function update(model, keyId, progress, candleId, { restoreCoat = true } = {}) {
    const active = progress > 0 && candleId;
    if (!restoreCoat && !active) return;
    // The held model wears per-model material copies: find the wax by its tag.
    const crust = model?.children.find(child => child.isMesh && child.userData.coatKind === 'wax');
    if (!crust) return;
    const key = keyIndex.get(keyId);
    if (!key) return;
    crust.userData.fullCoat ??= crust.geometry;
    const now = sceneNow();
    if (!(progress > 0)) {
      release(crust);
      crust.geometry = crust.userData.fullCoat;
      return;
    }
    if (melt.keyId !== key.id) {
      release(crust);
      const layout = getKeyCoatLayout(key.type, key.broken, 'wax') || [];
      Object.assign(melt, { keyId: key.id, layout, heat: new Float32Array(layout.length),
        points: layout.map(blob => getKeyCoatPoint(key.type, key.broken, blob.x, blob.y, 0)),
        reach: layout.map(blob => Math.max(blob.rx, blob.ry)), last: now, built: 0 });
    }
    const dt = Math.min(.1, (now - melt.last) / 1000);
    melt.last = now;
    const candle = candles.find(item => item.id === candleId);
    if (!candle || !melt.layout.length) return;
    crust.updateMatrixWorld(true);
    const flame = crust.worldToLocal(new THREE.Vector3(candle.x,
      candle.y + CANDLE_WICK_Y + CANDLE_FLAME_HEIGHT * .6, candle.z));
    const scale = getKeyCoatPoint(key.type, key.broken, 1, 0, 0)
      ?.distanceTo(getKeyCoatPoint(key.type, key.broken, 0, 0, 0)) || .3;
    let hottest = -1, hottestRate = 0;
    melt.layout.forEach((blob, index) => {
      const point = melt.points[index];
      if (!point) return;
      // Distance in the key's plane, measured in Forge units.
      const distance = Math.hypot(point.x - flame.x, point.y - flame.y) / scale;
      const rate = 1.5 * Math.exp(-Math.pow(distance / (.35 + melt.reach[index]), 2));
      melt.heat[index] = Math.min(1, melt.heat[index] + rate * dt);
      if (rate > hottestRate && melt.heat[index] < 1) { hottest = index; hottestRate = rate; }
    });
    // The rules finish melting on a timer; make sure nothing is left by then.
    const catchUp = Math.max(0, progress * 1.6 - .6);
    const melted = blob => Math.min(1, melt.heat[melt.layout.indexOf(blob)] + catchUp);
    if (now - melt.built > 60) {
      melt.built = now;
      const blobs = meltWaxBlobs(melt.layout, melted, { sag: false });
      if (melt.geometry) melt.geometry.dispose();
      melt.geometry = buildKeyCoatGeometry(key.type, key.broken, 'wax', { blobs, heightScale: 1 - .35 * progress });
      crust.geometry = melt.geometry;
    }
    if (hottest >= 0 && hottestRate > .25 && now - waxBeadAt > 150) {
      waxBeadAt = now;
      const blob = melt.layout[hottest];
      const local = getKeyCoatPoint(key.type, key.broken, blob.x + (Math.random() - .5) * blob.rx,
        blob.y + (Math.random() - .5) * blob.ry, -.02);
      if (local) cleaningEffects.drop('wax', crust.localToWorld(local), .007 + Math.random() * .006,
        candle.y + CANDLE_WICK_Y + .05);
    }
  }

  return { update };
}
