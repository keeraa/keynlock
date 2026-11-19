import * as THREE from '../vendor/three.js';
import {
  KEY_TYPES, TOTAL_KEYS, MAX_HELD, pickupKey, selectedKey, putKeyInCabinet,
  takeKeyFromCabinet, cabinetSlotKey, trashSelectedKey, dropSelectedKey, getProgress,
  startSoak, collectSoakedKey, bathContents,
} from './rules.js?v=24';
import { findFreeFloorSpot } from './key-spacing.js?v=18';
import { restingKeyY } from './floor-contact.js';
import { RIGHT_HAND_RELEASE } from './held-key-motion.js?v=2';

// All state-changing player actions live here and work identically in both renderers.
export function createArchiveActions({
  state, keyIndex, world, camera, targetInView, getYaw, isPlaying,
  save, updateHud, tone, toast, showVictory, invalidateHover,
}) {
  function interact() {
    if (!isPlaying()) return;
    const target = targetInView();
    if (!target) return;
    if (target.kind === 'key') {
      if (!pickupKey(state, target.id)) {
        toast('В руках помещается четыре ключа', true);
        tone('wrong');
        return;
      }
      world.syncKey(keyIndex.get(target.id));
      updateHud();
      save();
      tone('take');
      const picked = selectedKey(state);
      toast(picked.broken ? 'Сломанный ключ · отнеси к плавильне' :
        picked.mud && picked.rust ? 'Ключ в грязи и ржавчине · потребуется обе ванны' :
        picked.mud ? 'Грязный ключ · отмочи в воде' : picked.rust ? 'Ржавый ключ · погрузи в раствор' :
          `Ключ взят · ${KEY_TYPES[picked.type].name}`);
      invalidateHover();
      return;
    }
    if (target.kind === 'bath') {
      const key = selectedKey(state);
      if (key && startSoak(state, target.id, target.bathKind)) {
        world.workstations?.refreshBaths?.();
        updateHud();
        save();
        tone(target.bathKind === 'mud' ? 'water' : 'rust');
        toast(target.bathKind === 'mud' ? 'Ключ отмокает в воде · 5 секунд' : 'Ключ в очищающем растворе · 7 секунд');
      } else {
        const collected = collectSoakedKey(state, target.id);
        if (collected) {
          world.workstations?.refreshBaths?.();
          world.syncKey(collected);
          updateHud();
          save();
          tone('place');
          toast(collected.mud || collected.rust ? 'Один слой очищен · нужна вторая ванна' : 'Ключ очищен · можно нести к шкафу');
        } else {
          const contents = bathContents(state, target.id);
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
        toast('Плавильня принимает только сломанные ключи', true);
        tone('wrong');
        return;
      }
      world.animateDiscard(selectedKey(state), target.stationId);
      trashSelectedKey(state);
      updateHud();
      save();
      tone('melt');
      toast('Сломанный ключ переплавлен · +1 металл');
      invalidateHover();
      if (getProgress(state).processed === TOTAL_KEYS) setTimeout(showVictory, 1100);
      return;
    }
    if (target.kind !== 'cabinet') return;
    if (target.slot === null || target.slot === undefined) {
      toast('Наведи указатель на ячейку шкафа', true);
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
    if (!key) { toast('Сначала возьми ключ с пола'); return; }
    if (key.broken) {
      toast('Сломанный ключ · отнеси к плавильне', true);
      tone('wrong');
      return;
    }
    if (key.mud || key.rust) {
      toast('Сперва очисти ключ · используй ванны в центре зала', true);
      tone('wrong');
      return;
    }
    if (key.type !== target.type) {
      toast('Это шкаф для ключей «' + KEY_TYPES[target.type].name + '»', true);
      tone('wrong');
      return;
    }
    const keyType = key.type;
    if (!putKeyInCabinet(state, target.type, target.slot)) return;
    world.animatePlace(key, target.slot);
    world.refreshCabinet(keyType);
    updateHud();
    save();
    const progress = getProgress(state);
    if (progress.sorted[keyType] === progress.required[keyType]) {
      tone('finish');
      toast('Шкаф «' + KEY_TYPES[keyType].name + '» заполнен');
    } else {
      tone('place');
      toast('Ключ на своём месте');
    }
    invalidateHover();
    if (progress.processed === TOTAL_KEYS) setTimeout(showVictory, 1900);
  }

  function drop() {
    if (!isPlaying()) return;
    const key = selectedKey(state);
    if (!key) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const landing = findFreeFloorSpot(state.keys,
      camera.position.x + forward.x * 4.5, camera.position.z + forward.z * 4.5);
    const { x, z } = landing;
    camera.updateMatrixWorld(true);
    const releasePoint = camera.localToWorld(new THREE.Vector3(
      RIGHT_HAND_RELEASE.x, RIGHT_HAND_RELEASE.y, RIGHT_HAND_RELEASE.z));
    const start = { x: releasePoint.x, y: releasePoint.y, z: releasePoint.z };
    const end = { x, y: restingKeyY(x, z), z };
    dropSelectedKey(state, x, z, -getYaw() + .6);
    world.animateThrow(key, start, end);
    updateHud();
    save();
    tone('take');
    toast('Ключ брошен');
  }

  return { interact, drop };
}
