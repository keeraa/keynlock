import {
  KEY_TYPES, MAX_HELD, selectedKey, cabinetSlotKey, getProgress, bathContents, keyCondition,
} from './rules.js?v=24';

export function createArchivePrompts(state, keyIndex) {
  return function promptFor(target) {
    if (!target) return '';
    if (target.kind === 'key') {
      const key = keyIndex.get(target.id);
      if (!key || key.status !== 'floor') return '';
      const condition = keyCondition(key);
      const conditionNote = condition === 'broken' ? ' · СЛОМАН' :
        condition === 'both' ? ' · ГРЯЗЬ + РЖАВЧИНА' : condition === 'mud' ? ' · ГРЯЗЬ' :
        condition === 'rust' ? ' · РЖАВЧИНА' : '';
      return state.held.length >= MAX_HELD
        ? `<kbd>4/4</kbd> Руки заняты · положи ключ в шкаф или на пол`
        : `<kbd>E / У</kbd> Взять · ${KEY_TYPES[key.type].name.toLowerCase()}${conditionNote}`;
    }
    if (target.kind === 'bath') {
      const contents = bathContents(state, target.id);
      const held = selectedKey(state);
      const label = target.bathKind === 'mud' ? 'Ванна · отмачивание грязи' : 'Раствор · очистка ржавчины';
      const count = `${contents.keys.length}/4`;
      if (held && !held.broken && held[target.bathKind] && contents.space > 0)
        return `<kbd>E / У</kbd> Погрузить ключ · ${label} · ${count}`;
      if (contents.ready.length && state.held.length < MAX_HELD)
        return `<kbd>E / У</kbd> Забрать очищенный ключ · ${count}`;
      if (contents.ready.length) return `Ключ готов · освободи место в руках · ${count}`;
      if (contents.pending.length) {
        const seconds = Math.max(1, Math.ceil(Math.min(...contents.pending.map(key => key.bathUntil)) / 1000 - Date.now() / 1000));
        return `${label} · ${count} · осталось ≈${seconds} сек`;
      }
      return contents.space ? `${label} · ${count} · <kbd>E / У</kbd> опустить подходящий ключ` : `${label} · ванна заполнена`;
    }
    if (target.kind === 'forge') {
      const held = selectedKey(state);
      if (!held) return 'Урна-плавильня · сломанные ключи → металл · <kbd>E / У</kbd>';
      return held.broken
        ? '<kbd>E / У</kbd> Переплавить сломанный ключ · +1 металл'
        : 'Урна-плавильня · здесь перерабатываются только сломанные ключи';
    }
    const key = selectedKey(state);
    const progress = getProgress(state);
    const count = progress.sorted[target.type];
    const required = progress.required[target.type];
    if (!Number.isInteger(target.slot))
      return `Шкаф «${KEY_TYPES[target.type].name}» · ${count}/${required} · наведи на ячейку`;
    const cell = target.slot + 1;
    const occupant = cabinetSlotKey(state, target.type, target.slot);
    if (occupant) return state.held.length >= MAX_HELD
      ? `Ячейка ${cell} занята · освободи место в руках`
      : `<kbd>E / У</kbd> Взять ключ из ячейки ${cell} · ${count}/${required}`;
    if (!key) return `Шкаф «${KEY_TYPES[target.type].name}» · ячейка ${cell} свободна`;
    if (key.broken) return '<kbd>!</kbd> Сломанный ключ · отнеси к ближайшей плавильне';
    if (key.mud || key.rust) return '<kbd>!</kbd> Ключ нужно очистить · ванны в центре зала';
    return key.type === target.type
      ? `<kbd>E / У</kbd> Положить в ячейку ${cell} · ${KEY_TYPES[target.type].name} · ${count}/${required}`
      : `Шкаф для ключей «${KEY_TYPES[target.type].name}»`;
  };
}
