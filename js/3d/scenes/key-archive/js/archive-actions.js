import * as THREE from '../vendor/three.js';
import {
  KEY_TYPES, TOTAL_KEYS, MAX_HELD, pickupKey, selectedKey, putKeyInCabinet,
  takeKeyFromCabinet, cabinetSlotKey, trashSelectedKey, dropSelectedKey, getProgress,
  startSoak, collectSoakedKey, BUNDLE_COST, buyBundle, putBundleInCabinet, meltSelectedWax,
  SMELT_SECONDS, settleSmelting,
} from './rules.js?v=key-ring';
import { WAX_MELT_MS } from './archive-candles.js?v=candlelight';
import { CABINET_CAPACITY, pegForSlot } from './cabinet-layout.js?v=cabinet-cell-glow';
import { findFreeFloorSpot } from './key-spacing.js?v=18';
import { restingKeyY } from './floor-contact.js';
import { BUNDLE_RELEASE_INTERVAL_MS } from './archive-key-motion.js?v=key-ring';
import { RIGHT_HAND_RELEASE } from './held-key-motion.js?v=2';

// All state-changing player actions live here and work identically in both renderers.
export function createArchiveActions({
  state, keyIndex, world, camera, targetInView, getYaw, isPlaying,
  save, updateHud, tone, toast, showVictory, invalidateHover,
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
    if (!key.mud && !key.rust) world.shineHand?.();
    updateHud();
    save();
    tone('waxDone');
    toast(key.mud || key.rust ? 'Воск растаял · остался ещё слой' : 'Воск растаял · ключ чистый');
    invalidateHover();
  }

  function interact() {
    if (!isPlaying()) return;
    const target = targetInView();
    if (!target || world.workstations?.isLifting?.(selectedKey(state)?.id)) return;
    if (target.kind === 'candle') {
      const key = selectedKey(state);
      if (!target.lit || !key?.wax || key.broken) return;
      if (melting?.candleId === target.id && melting.keyId === key.id) return;
      melting = { candleId: target.id, keyId: key.id, until: performance.now() + WAX_MELT_MS };
      toast('Держи ключ у пламени');
      invalidateHover();
      return;
    }
    if (target.kind === 'key') {
      const picked = keyIndex.get(target.id);
      if (!pickupKey(state, target.id)) {
        toast('В руках помещается четыре ключа', true);
        tone('wrong');
        return;
      }
      world.syncKey?.(picked);
      updateHud();
      save();
      tone(picked.status === 'bundled' ? 'bundle' : 'take');
      toast(picked.status === 'bundled' ? 'Связка собрана · четыре ключа отдельно от инвентаря' :
        picked.broken ? 'Сломанный ключ · отнеси к плавильне' :
        picked.wax ? 'Ключ в воске · растопи у свечи' :
        picked.mud && picked.rust ? 'Ключ в грязи и ржавчине · потребуется обе ванны' :
        picked.mud ? 'Грязный ключ · отмочи в воде' : picked.rust ? 'Ржавый ключ · погрузи в раствор' :
          `Ключ взят · ${KEY_TYPES[picked.type].name}`);
      invalidateHover();
      return;
    }
    if (target.kind === 'bath') {
      const key = selectedKey(state);
      if (key?.wax) { toast('Ключ в воске · растопи у свечи', true); return; }
      if (key && startSoak(state, target.id, target.bathKind)) {
        updateHud();
        save();
        // The rust splash sounds from the tray once the key lands (wash-forge-stations).
        toast(target.bathKind === 'mud' ? 'Промываем ключ' : 'Ключ замочен · 30 секунд');
      } else {
        const aimed = target.keyId && keyIndex.get(target.keyId);
        if (aimed && aimed.bathUntil > Date.now()) {
          toast(target.bathKind === 'mud' ? 'Этот ключ ещё промывается' : 'Этот ключ ещё отмокает', true);
          tone('wrong');
          invalidateHover();
          return;
        }
        const collected = collectSoakedKey(state, target.id, Date.now(), target.keyId ?? null);
        if (collected) {
          world.workstations?.liftKey?.(target.id, collected);
          world.syncKey?.(collected);
          updateHud();
          save();
          tone('lift');
          toast(collected.mud || collected.rust ? 'Один слой очищен · нужна вторая ванна' : 'Ключ очищен · можно нести к шкафу');
        } else {
          const contents = keyIndex.bathContents(target.id);
          toast(contents.ready.length && state.held.length >= MAX_HELD ? 'Освободи место для чистого ключа' :
            contents.space === 0 ? 'Ванна заполнена · четыре ключа' :
              contents.pending.length ? 'Подожди, пока ключи отмокнут' :
                target.bathKind === 'mud' ? 'Здесь очищают ключи от грязи' : 'Здесь удаляют ржавчину', true);
          tone('wrong');
        }
      }
      invalidateHover();
      return;
    }
    if (target.kind === 'forge') {
      if (!selectedKey(state)?.broken) {
        if (state.bundles) { toast('Кольцо уже куплено'); return; }
        if (buyBundle(state)) {
          updateHud();
          save();
          tone('bundle');
          toast(state.activeBundle ? 'Связка готова к переноске' :
            'Связка куплена · четыре чистых ключа одного семейства свяжутся сами');
          invalidateHover();
        } else {
          toast(`Связка стоит ${BUNDLE_COST} металла · сейчас ${state.metal ?? 0}`, true);
          tone('wrong');
        }
        return;
      }
      world.animateDiscard(selectedKey(state), target.stationId);
      trashSelectedKey(state);
      updateHud();
      save();
      tone('release');
      const queued = getProgress(state).smelting;
      toast(queued > 1 ? `Ключ в очереди на плавку · впереди ${queued - 1}` :
        `Ключ плавится · ${SMELT_SECONDS} секунд`);
      // (the bar over the forge shows the countdown and the whole queue)
      invalidateHover();
      return;
    }
    if (target.kind !== 'cabinet') return;
    if (target.slot === null || target.slot === undefined) {
      toast(target.full ? 'Все ячейки этого шкафа заняты' : 'Наведи указатель на ячейку шкафа', true);
      return;
    }
    const occupied = cabinetSlotKey(state, target.type, target.slot);
    if (occupied) {
      const taken = takeKeyFromCabinet(state, target.type, target.slot);
      if (!taken) {
        toast('В руках помещается четыре ключа', true);
        tone('wrong');
        return;
      }
      world.cancelPlace?.(taken.id);
      world.refreshCabinet(target.type);
      updateHud();
      save();
      tone('take');
      toast('Ключ снят с ячейки · можно переложить');
      invalidateHover();
      return;
    }
    const key = selectedKey(state);
    const keyType = target.type;
    const bundle = state.activeBundle?.type === keyType;
    if (!bundle && !key) { toast('Сначала возьми ключ с пола'); return; }
    if (!bundle && key.broken) {
      toast('Сломанный ключ · отнеси к плавильне', true);
      tone('wrong');
      return;
    }
    if (!bundle && key.wax) { toast('Ключ в воске · растопи у свечи', true); return; }
    if (!bundle && (key.mud || key.rust)) {
      toast('Сперва очисти ключ · используй ванны в центре зала', true);
      tone('wrong');
      return;
    }
    if (!bundle && key.type !== target.type) {
      toast('Это шкаф для ключей «' + KEY_TYPES[target.type].name + '»', true);
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
        toast('Для связки нужно четыре свободные ячейки', true);
        return;
      }
      bundled.forEach((item, index) => world.animatePlace(item, slots[index], {
        fromRing: true, delay: index * BUNDLE_RELEASE_INTERVAL_MS,
      }));
    } else {
      if (!putKeyInCabinet(state, target.type, target.slot)) return;
      world.animatePlace(key, target.slot);
    }
    world.refreshCabinet(keyType);
    updateHud();
    save();
    if (bundle) tone('bundle');
    const progress = getProgress(state);
    if (progress.sorted[keyType] === progress.required[keyType]) {
      toast('Шкаф «' + KEY_TYPES[keyType].name + '» заполнен');
    } else {
      toast(bundle ? 'Четыре ключа на своих местах' : 'Ключ на своём месте');
    }
    invalidateHover();
    if (progress.processed === TOTAL_KEYS) setTimeout(showVictory, 1900);
  }

  function drop() {
    if (!isPlaying()) return;
    const key = selectedKey(state);
    if (!key || world.workstations?.isLifting?.(key.id)) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const aimHeight = forward.y;
    forward.y = 0;
    forward.normalize();
    camera.updateMatrixWorld(true);
    const releasePoint = camera.localToWorld(new THREE.Vector3(
      RIGHT_HAND_RELEASE.x, RIGHT_HAND_RELEASE.y, RIGHT_HAND_RELEASE.z));
    const reach = 3.4 + aimHeight * 1.1;
    const { x, z } = findFreeFloorSpot(state.keys,
      releasePoint.x + forward.x * reach, releasePoint.z + forward.z * reach);
    const start = { x: releasePoint.x, y: releasePoint.y, z: releasePoint.z, lift: 1.15 + aimHeight * 2 };
    const end = { x, y: restingKeyY(x, z) + (key.layer || 0), z };
    dropSelectedKey(state, x, z, -getYaw() + .6);
    world.animateThrow(key, start, end);
    updateHud();
    save();
    tone('release');
    toast('Ключ брошен');
  }

  // Metal is ready when a smelt finishes, even while the player is elsewhere.
  function updateSmelting(now = Date.now()) {
    const settled = settleSmelting(state, now);
    if (!settled) return;
    updateHud();
    save();
    tone('ready');
    toast(settled > 1 ? `Металл готов · +${settled}` : 'Металл готов · +1');
    if (getProgress(state).processed === TOTAL_KEYS) setTimeout(showVictory, 1100);
  }

  return { interact, drop, updateWax, updateSmelting, isMelting: () => Boolean(melting) };
}
