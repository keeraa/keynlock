import { t, familyName } from './i18n.js';
import { SOAK_SECONDS } from './station-layout.js';
import * as THREE from '../vendor/three.js';
import {
  KEY_TYPES, TOTAL_KEYS, MAX_HELD, pickupKey, selectedKey, putKeyInCabinet,
  takeKeyFromCabinet, cabinetSlotKey, trashSelectedKey, dropSelectedKey, getProgress,
  startSoak, collectSoakedKey, BUNDLE_COST, buyBundle, putBundleInCabinet, meltSelectedWax,
  SMELT_SECONDS, settleSmelting, canSoak, soakThrownKey, smeltThrownKey,
} from './rules.js';
import { WAX_MELT_MS } from './archive-candles.js';
import { CABINET_CAPACITY, pegForSlot } from './cabinet-layout.js';
import { simulateThrow, reticleTarget, launchTowards } from './throw-flight.js';
import { restingKeyY } from './floor-contact.js';
import { BUNDLE_RELEASE_INTERVAL_MS } from './archive-key-motion.js';
import { RIGHT_HAND_RELEASE } from './held-key-motion.js';

// All state-changing player actions live here and work identically in both renderers.
export function createArchiveActions({
  state, keyIndex, world, camera, targetInView, getYaw, isPlaying,
  save, updateHud, tone, toast, showVictory, invalidateHover, statistics, openCatalog, stationNow = Date.now,
}) {
  let melting = null;

  function updateWax(now, target) {
    if (!melting) return;
    const key = selectedKey(state);
    if (!isPlaying() || target?.id !== melting.candleId || !target.lit || key?.id !== melting.keyId) {
      melting = null;
      world.meltHeldWax?.(0);
      invalidateHover();
      return;
    }
    world.meltHeldWax?.(1 - (melting.until - now) / WAX_MELT_MS, melting.candleId);
    if (now < melting.until) return;
    melting = null;
    if (!meltSelectedWax(state)) return;
    // Fly back to the hand; the clean model replaces the coat on its own.
    world.meltHeldWax?.(0, null, { restoreCoat: false });
    if (!key.mud && !key.rust && world.shineHand) world.shineHand(key.id);
    else tone('waxDone');
    statistics?.record('wax', { dewaxed: 1, cleaned: key.mud || key.rust ? 0 : 1 });
    updateHud();
    save();
    toast(t(key.mud || key.rust ? 'toast.waxMeltedLayer' : 'toast.waxMeltedClean'));
    invalidateHover();
  }

  function interact({ buyRingWithHeldKey = false } = {}) {
    if (!isPlaying()) return;
    const target = targetInView();
    if (!target || world.workstations?.isLifting?.(selectedKey(state)?.id)) return;
    if (target.kind === 'ledger') { openCatalog?.(); return; }
    if (target.kind === 'candle') {
      const key = selectedKey(state);
      if (!target.lit || !key?.wax || key.broken) return;
      if (melting?.candleId === target.id && melting.keyId === key.id) return;
      melting = { candleId: target.id, keyId: key.id, until: stationNow() + WAX_MELT_MS };
      toast(t('toast.holdToFlame'));
      invalidateHover();
      return;
    }
    if (target.kind === 'key') {
      const picked = keyIndex.get(target.id);
      if (!pickupKey(state, target.id)) {
        toast(t('toast.handsFull'), true);
        tone('wrong');
        return;
      }
      statistics?.record('pickup', { pickedUp: 1 });
      world.syncKey?.(picked);
      updateHud();
      save();
      if (picked.status === 'held') world.animatePickup?.();
      tone(picked.status === 'bundled' ? 'bundle' : 'pickup');
      toast(picked.status === 'bundled' ? t('toast.bundleMade') :
        picked.broken ? t('toast.pickedBroken') :
        picked.wax ? t('toast.pickedWax') :
        picked.mud && picked.rust ? t('toast.pickedMudRust') :
        picked.mud ? t('toast.pickedMud') : picked.rust ? t('toast.pickedRust') :
          t('toast.picked', { name: familyName(picked.type) }));
      invalidateHover();
      return;
    }
    if (target.kind === 'bath') {
      const now = stationNow();
      const key = selectedKey(state);
      if (key?.wax) { toast(t('toast.pickedWax'), true); return; }
      if (key && startSoak(state, target.id, target.bathKind, now)) {
        statistics?.record(target.bathKind === 'mud' ? 'rinse' : 'rust');
        updateHud();
        save();
        // The rust splash sounds from the tray once the key lands (wash-forge-stations).
        toast(target.bathKind === 'mud' ? t('toast.washing') : t('toast.soaking', { seconds: SOAK_SECONDS.rust }));
      } else {
        const aimed = target.keyId && keyIndex.get(target.keyId);
        if (aimed && aimed.bathUntil > now) {
          toast(t(target.bathKind === 'mud' ? 'toast.stillWashing' : 'toast.stillSoaking'), true);
          tone('wrong');
          invalidateHover();
          return;
        }
        // One press takes every ready key that fits in the hands. The aimed key
        // comes out last: it is the one that rises from the bath into the hand.
        const ready = keyIndex.bathContents(target.id, now).ready;
        const ordered = [...ready.filter(item => item.id !== target.keyId),
          ...ready.filter(item => item.id === target.keyId)];
        const taken = [];
        for (const item of ordered) {
          if (state.held.length >= MAX_HELD) break;
          const collected = collectSoakedKey(state, target.id, now, item.id);
          if (collected) taken.push(collected);
        }
        if (taken.length) {
          const washed = target.bathKind === 'mud';
          for (const collected of taken) {
            statistics?.record(washed ? 'rinse' : 'rust', {
              [washed ? 'washed' : 'derusted']: 1,
              cleaned: collected.mud || collected.rust || collected.wax ? 0 : 1,
            });
            world.syncKey?.(collected);
          }
          const shown = taken.at(-1);
          world.workstations?.liftKey?.(target.id, shown);
          updateHud();
          save();
          tone('lift');
          toast(taken.length > 1 ? t('toast.keysTaken', { count: taken.length }) :
            t(shown.mud || shown.rust ? 'toast.layerCleaned' : 'toast.keyCleaned'));
        } else {
          const contents = keyIndex.bathContents(target.id, now);
          toast(t(contents.ready.length && state.held.length >= MAX_HELD ? 'toast.freeHands' :
            contents.space === 0 ? 'toast.bathFull' :
              contents.pending.length ? 'toast.waitSoak' :
                target.bathKind === 'mud' ? 'toast.mudBathInfo' : 'toast.rustBathInfo'), true);
          tone('wrong');
        }
      }
      invalidateHover();
      return;
    }
    if (target.kind === 'forge') {
      const key = selectedKey(state);
      const canBuyRing = !state.bundles && (state.metal ?? 0) >= BUNDLE_COST;
      if (key && !key.broken && !(buyRingWithHeldKey && canBuyRing)) {
        toast(t('toast.intactKey'), true);
        tone('wrong');
        return;
      }
      if (!key?.broken) {
        if (state.bundles) return;
        if (buyBundle(state)) {
          updateHud();
          save();
          tone('bundle');
          if (state.activeBundle) toast(t('toast.bundleReady'));
          invalidateHover();
        } else {
          toast(t('toast.ringPrice', { cost: BUNDLE_COST, metal: state.metal ?? 0 }), true);
          tone('wrong');
        }
        return;
      }
      world.animateDiscard(key, target.stationId);
      trashSelectedKey(state, stationNow());
      statistics?.record('forge');
      updateHud();
      save();
      tone('release');
      const queued = getProgress(state).smelting;
      toast(queued > 1 ? t('toast.smeltQueued', { ahead: queued - 1 }) :
        t('toast.smelting', { seconds: SMELT_SECONDS }));
      // (the bar over the forge shows the countdown and the whole queue)
      invalidateHover();
      return;
    }
    if (target.kind !== 'cabinet') return;
    if (target.slot === null || target.slot === undefined) {
      toast(t(target.full ? 'toast.cabinetFull' : 'toast.aimCell'), true);
      return;
    }
    const occupied = cabinetSlotKey(state, target.type, target.slot);
    if (occupied) {
      const taken = takeKeyFromCabinet(state, target.type, target.slot);
      if (!taken) {
        toast(t('toast.handsFull'), true);
        tone('wrong');
        return;
      }
      world.cancelPlace?.(taken.id);
      world.refreshCabinet(target.type);
      updateHud();
      save();
      tone('take');
      toast(t('toast.takenFromCell'));
      invalidateHover();
      return;
    }
    const key = selectedKey(state);
    const keyType = target.type;
    const bundle = state.activeBundle?.type === keyType;
    if (!bundle && !key) { toast(t('toast.pickFirst')); return; }
    if (!bundle && key.broken) {
      toast(t('toast.pickedBroken'), true);
      tone('wrong');
      return;
    }
    if (!bundle && key.wax) { toast(t('toast.pickedWax'), true); return; }
    if (!bundle && (key.mud || key.rust)) {
      toast(t('toast.cleanFirst'), true);
      tone('wrong');
      return;
    }
    if (!bundle && key.type !== target.type) {
      toast(t('toast.wrongCabinet', { name: familyName(target.type) }), true);
      tone('wrong');
      return;
    }
    if (bundle) {
      const center = pegForSlot(target.slot);
      const distance = slot => {
        const peg = pegForSlot(slot);
        return (peg.x - center.x) ** 2 + (peg.y - center.y) ** 2;
      };
      const occupiedSlots = new Set(state.keys.filter(item => item.type === keyType && item.status === 'sorted')
        .map(item => item.cabinetSlot));
      const slots = Array.from({ length: CABINET_CAPACITY - target.slot }, (_, i) => target.slot + i)
        .filter(slot => !occupiedSlots.has(slot)).slice(0, MAX_HELD);
      if (slots.length < MAX_HELD) {
        const before = Array.from({ length: target.slot }, (_, slot) => slot)
          .filter(slot => !occupiedSlots.has(slot)).sort((a, b) => distance(a) - distance(b));
        slots.push(...before.slice(0, MAX_HELD - slots.length));
      }
      const bundled = putBundleInCabinet(state, keyType, slots);
      if (!bundled) {
        toast(t('toast.bundleCells'), true);
        return;
      }
      bundled.forEach((item, index) => world.animatePlace(item, slots[index], {
        fromRing: true, delay: index * BUNDLE_RELEASE_INTERVAL_MS,
      }));
    } else {
      if (!putKeyInCabinet(state, target.type, target.slot)) return;
      world.animatePlace(key, target.slot);
    }
    statistics?.record('sorted');
    world.refreshCabinet(keyType);
    updateHud();
    save();
    if (bundle) tone('bundle');
    const progress = getProgress(state);
    if (progress.sorted[keyType] === progress.required[keyType]) {
      toast(t('toast.cabinetDone', { name: familyName(keyType) }));
    } else {
      toast(t(bundle ? 'toast.bundlePlaced' : 'toast.keyPlaced'));
    }
    invalidateHover();
    if (progress.processed === TOTAL_KEYS) setTimeout(showVictory, 1900);
  }

  function drop() {
    if (!isPlaying()) return;
    const key = selectedKey(state);
    if (!key || world.workstations?.isLifting?.(key.id)) return;
    // The key is tossed from the hand onto the point under the reticle (the
    // floor, a tabletop, a vessel's opening), with the strength that needs;
    // beyond reach, onto the floor at full reach ahead. The flight is
    // simulated now and only replayed by the animation.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.updateMatrixWorld(true);
    const release = world.getThrowRelease?.() ?? camera.localToWorld(new THREE.Vector3(
      RIGHT_HAND_RELEASE.x, RIGHT_HAND_RELEASE.y, RIGHT_HAND_RELEASE.z));
    const now = stationNow();
    // A vessel takes the key only if it could go there by hand.
    const accepts = vessel => vessel.kind === 'forge' ? key.broken
      : canSoak(state, key, vessel.id, vessel.kind, now);
    const throwScene = world.getThrowScene?.().forKey(accepts) ?? {};
    const start = { x: release.x, y: release.y, z: release.z };
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const target = reticleTarget({ eye, forward, floorY: restingKeyY, ...throwScene });
    const flight = simulateThrow({ start, floorY: restingKeyY, ...throwScene,
      velocity: launchTowards(start, target) });
    const { landing } = flight;
    // Until a key bound for a vessel arrives it lies on the floor in front of
    // the workbench (only seen if the page reloads mid-flight).
    const rest = landing.on === 'vessel'
      ? towards(landing, release, 1.1) : landing;
    dropSelectedKey(state, rest.x, rest.z, -getYaw() + .6);
    // A key resting on a tabletop keeps its height above the floor.
    key.layer = landing.on === 'surface' ? Math.max(0, landing.y - restingKeyY(landing.x, landing.z) + .004) : 0;
    world.animateThrow(key, flight, landed => keyLanded(key, landed, flight));
    statistics?.record('throw', { throws: 1 });
    updateHud();
    save();
    tone('throw');
    toast(t('toast.thrown'));
  }

  function towards(from, to, metres) {
    const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz) || 1;
    return { x: from.x + dx / length * metres, z: from.z + dz / length * metres };
  }

  // A thrown key came to rest. In a vessel that takes it, it starts there just
  // as if put in by hand; bounced off a vessel, it says so with a dull knock.
  function keyLanded(key, landing, flight) {
    if (key.status !== 'floor') return;
    const now = stationNow();
    if (landing.on === 'vessel' && landing.kind === 'forge') {
      if (!smeltThrownKey(state, key, now)) return;
      world.workstations?.startMelt?.();
      statistics?.record('forge');
      tone('melt');
      const queued = getProgress(state).smelting;
      toast(queued > 1 ? t('toast.smeltQueued', { ahead: queued - 1 }) : t('toast.smelting', { seconds: SMELT_SECONDS }));
    } else if (landing.on === 'vessel') {
      if (!soakThrownKey(state, key, landing.vessel, landing.kind, now)) return;
      statistics?.record(landing.kind === 'mud' ? 'rinse' : 'rust');
      if (landing.kind === 'mud') tone('water');
      toast(landing.kind === 'mud' ? t('toast.washing') : t('toast.soaking', { seconds: SOAK_SECONDS.rust }));
    } else {
      if (flight.bouncedOff) tone('wrong');
      return;
    }
    world.syncKey?.(key);
    updateHud();
    save();
    invalidateHover();
  }

  // Metal is ready when a smelt finishes, even while the player is elsewhere.
  function updateSmelting(now = stationNow()) {
    const settled = settleSmelting(state, now);
    if (!settled) return;
    statistics?.record('forge');
    updateHud();
    save();
    tone('ready');
    toast(t('toast.metalReady', { count: settled }));
    if (getProgress(state).processed === TOTAL_KEYS) setTimeout(showVictory, 1100);
  }

  return { interact, drop, updateWax, updateSmelting, isMelting: () => Boolean(melting) };
}
