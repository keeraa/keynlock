import {
  KEY_TYPES, MAX_HELD, selectedKey, cabinetSlotKey, getProgress, keyCondition, BUNDLE_COST, canPickupKey, SMELT_SECONDS } from './rules.js?v=key-ring';

export function createArchivePrompts(state, keyIndex, isMelting = () => false) {
  return function promptFor(target) {
    if (!target) return '';
    if (target.kind === 'key') {
      const key = keyIndex.get(target.id);
      if (!key || key.status !== 'floor') return '';
      const condition = keyCondition(key);
      const conditionNote = condition === 'broken' ? ' · СЛОМАН' :
        condition === 'wax' ? ' · ВОСК' : condition === 'both' ? ' · ГРЯЗЬ + РЖАВЧИНА' : condition === 'mud' ? ' · ГРЯЗЬ' :
        condition === 'rust' ? ' · РЖАВЧИНА' : '';
      return !canPickupKey(state, key)
        ? `<kbd>4/4</kbd> Руки заняты · положи ключ в шкаф или на пол`
        : `<kbd>E / У</kbd> Взять · ${KEY_TYPES[key.type].name.toLowerCase()}${conditionNote}`;
    }
    if (target.kind === 'candle') {
      if (!target.lit) return 'Свеча зажжётся, когда шкаф будет заполнен';
      const key = selectedKey(state);
      if (!key?.wax || key.broken) return 'Здесь можно растопить воск на ключе';
      return isMelting() ? 'Воск тает · держи ключ у пламени' : '<kbd>E / У</kbd> Поднести ключ к пламени';
    }
    if (target.kind === 'bath') {
      const contents = keyIndex.bathContents(target.id);
      const held = selectedKey(state);
      if (held?.wax) return 'Ключ в воске · растопи у свечи';
      const label = target.bathKind === 'mud' ? 'Вода · промывка' : 'Раствор · очистка ржавчины';
      const count = `${contents.keys.length}/4`;
      if (held && !held.broken && held[target.bathKind] && contents.space > 0)
        return `<kbd>E / У</kbd> Погрузить ключ · ${label} · ${count}`;
      const aimed = target.keyId && keyIndex.get(target.keyId);
      if (aimed) {
        const name = KEY_TYPES[aimed.type].name;
        const left = Math.ceil((aimed.bathUntil - Date.now()) / 1000);
        if (left > 0) return `${name} · ещё ${left} с · ${label}`;
        return state.held.length < MAX_HELD ? `<kbd>E / У</kbd> Забрать этот ключ · ${name}`
          : `${name} готов · освободи место в руках`;
      }
      if (contents.ready.length && state.held.length < MAX_HELD)
        return `<kbd>E / У</kbd> Забрать очищенный ключ · ${count}`;
      if (contents.ready.length) return `Ключ готов · освободи место в руках · ${count}`;
      if (contents.pending.length) {
        return `${label} · ключ в обработке · ${count}`;
      }
      return contents.space ? `${label} · ${count} · <kbd>E / У</kbd> опустить подходящий ключ` : `${label} · ванна заполнена`;
    }
    if (target.kind === 'forge') {
      const held = selectedKey(state);
      if (held?.broken) return `<kbd>E / У</kbd> Переплавить сломанный ключ · ${SMELT_SECONDS} с · +1 металл`;
      if (state.bundles) return 'Кольцо уже куплено · вмещает четыре ключа одного семейства';
      const amount = state.metal ?? 0;
      return amount >= BUNDLE_COST
        ? `<kbd>E / У</kbd> Купить связку · ${BUNDLE_COST} металла`
        : `Плавильня · связка за ${BUNDLE_COST} металла · сейчас ${amount}`;
    }
    const key = selectedKey(state);
    const progress = getProgress(state);
    const count = progress.sorted[target.type];
    const required = progress.required[target.type];
    if (target.full) return `Шкаф «${KEY_TYPES[target.type].name}» заполнен · ${count}/${required}`;
    if (!Number.isInteger(target.slot))
      return `Шкаф «${KEY_TYPES[target.type].name}» · ${count}/${required} · наведи на ячейку`;
    const cell = target.slot + 1;
    const occupant = cabinetSlotKey(state, target.type, target.slot);
    if (occupant) return state.held.length >= MAX_HELD
      ? `Ячейка ${cell} занята · освободи место в руках`
      : `<kbd>E / У</kbd> Взять ключ из ячейки ${cell} · ${count}/${required}`;
    if (state.activeBundle?.type === target.type)
      return '<kbd>E / У</kbd> Повесить связку · 4 ближайшие свободные ячейки';
    if (!key) return `Шкаф «${KEY_TYPES[target.type].name}» · ячейка ${cell} свободна`;
    if (key.broken) return '<kbd>!</kbd> Сломанный ключ · отнеси к ближайшей плавильне';
    if (key.wax) return '<kbd>!</kbd> Ключ в воске · растопи у свечи';
    if (key.mud || key.rust) return '<kbd>!</kbd> Ключ нужно очистить · ванны в центре зала';
    if (target.assisted) return `<kbd>E / У</kbd> Положить в ячейку ${cell} · можно навести на другую`;
    return key.type === target.type
      ? `<kbd>E / У</kbd> Положить в ячейку ${cell} · ${KEY_TYPES[target.type].name} · ${count}/${required}`
      : `Шкаф для ключей «${KEY_TYPES[target.type].name}»`;
  };
}
