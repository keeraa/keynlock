import { t, familyName } from './i18n.js';
import {
  KEY_TYPES, MAX_HELD, selectedKey, cabinetSlotKey, getProgress, keyCondition, BUNDLE_COST, canPickupKey, SMELT_SECONDS,
  heldBatch } from './rules.js';

export function createArchivePrompts(state, keyIndex, isMelting = () => false, stationNow = Date.now) {
  return function promptFor(target) {
    if (!target) return '';
    if (target.kind === 'key') {
      const key = keyIndex.get(target.id);
      if (!key || key.status !== 'floor') return '';
      const condition = keyCondition(key);
      const conditionNote = ['broken', 'wax', 'both', 'mud', 'rust'].includes(condition)
        ? t(`prompt.cond.${condition}`) : '';
      return !canPickupKey(state, key)
        ? t('prompt.handsFull')
        : t('prompt.take', { name: familyName(key.type).toLowerCase(), note: conditionNote });
    }
    if (target.kind === 'ledger') return t('prompt.openCatalog');
    if (target.kind === 'candle') {
      const key = selectedKey(state);
      if (!key?.wax || key.broken) return '';
      // Candles beside a cabinet burn once that cabinet is full.
      if (!target.lit) return t('prompt.candleUnlit');
      return t(isMelting() ? 'prompt.candleMelting' : 'prompt.candleUse');
    }
    if (target.kind === 'bath') {
      const now = stationNow();
      const contents = keyIndex.bathContents(target.id, now);
      const held = selectedKey(state);
      if (held?.wax) return t('toast.pickedWax');
      const label = t(target.bathKind === 'mud' ? 'prompt.labelMud' : 'prompt.labelRust');
      const count = `${contents.keys.length}/4`;
      if (held && !held.broken && held[target.bathKind] && contents.space > 0)
        return t('prompt.dip', { label, count });
      const aimed = target.keyId && keyIndex.get(target.keyId);
      if (aimed) {
        const name = familyName(aimed.type);
        const left = Math.ceil((aimed.bathUntil - now) / 1000);
        if (left > 0) return t('prompt.aimedLeft', { name, left, label });
        return state.held.length < MAX_HELD ? t('prompt.takeThis', { name })
          : t('prompt.aimedReadyFull', { name });
      }
      if (contents.ready.length && state.held.length < MAX_HELD)
        return t('prompt.takeClean', { count });
      if (contents.ready.length) return t('prompt.readyFull', { count });
      if (contents.pending.length) {
        return t('prompt.processing', { label, count });
      }
      return contents.space ? t('prompt.bathIdle', { label, count }) : t('prompt.bathFull', { label });
    }
    if (target.kind === 'forge') {
      const held = selectedKey(state);
      const metal = state.metal ?? 0;
      if (held?.broken) return t('prompt.smelt', { seconds: SMELT_SECONDS, metal });
      if (!state.bundles && metal >= BUNDLE_COST) return t('prompt.buyRing', { cost: BUNDLE_COST, metal });
      if (held || state.bundles) return t('prompt.forgeMetal', { metal });
      return t('prompt.forgeInfo', { cost: BUNDLE_COST, metal });
    }
    const key = selectedKey(state);
    const progress = getProgress(state);
    const count = progress.sorted[target.type];
    const required = progress.required[target.type];
    if (target.full) return t('prompt.cabinetFull', { name: familyName(target.type), count, required });
    if (!Number.isInteger(target.slot))
      return t('prompt.cabinetAim', { name: familyName(target.type), count, required });
    const cell = target.slot + 1;
    const occupant = cabinetSlotKey(state, target.type, target.slot);
    if (occupant) return state.held.length >= MAX_HELD
      ? t('prompt.cellTakenFull', { cell })
      : t('prompt.takeFromCell', { cell, count, required });
    if (state.activeBundle?.type === target.type)
      return t('prompt.hangBundle');
    if (!key) return t('prompt.cellFree', { name: familyName(target.type), cell });
    if (key.broken) return t('prompt.brokenToForge');
    if (key.wax) return t('prompt.waxToCandle');
    if (key.mud || key.rust) return t('prompt.cleanFirst');
    if (target.assisted) return t('prompt.putAssisted', { cell });
    // Four of this family in hand: they all go in from this cell.
    if (key.type === target.type && heldBatch(state, target.type))
      return t('prompt.putFour', { cell, name: familyName(target.type), count, required });
    return key.type === target.type
      ? t('prompt.put', { cell, name: familyName(target.type), count, required })
      : t('prompt.cabinetFor', { name: familyName(target.type) });
  };
}
