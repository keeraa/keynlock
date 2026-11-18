import { KEY_TYPES, MAX_HELD, getProgress, selectedKey } from './rules.js?v=22';
import { thumbnailCacheKey } from './key-thumbnails.js';
import { createKeyFallbackStamp } from './key-factory.js?v=3';

export const KEY_SYMBOLS = Object.freeze(['◯', '⌃', '□', '◇', '⚙', '⬡', '★', '✿', '⬭', '∞']);

export function createArchiveHud(document, world, state, keyIndex) {
  const $ = id => document.getElementById(id);
  const inventoryImages = new Map();

  function thumbnail(key) {
    const signature = thumbnailCacheKey(key);
    if (inventoryImages.has(signature)) return inventoryImages.get(signature);
    let result = null;
    try {
      result = world.captureKeyThumbnail?.(key) ||
        createKeyFallbackStamp(key.type, key.broken)?.toDataURL('image/png') || null;
    } catch (error) { console.warn('Не удалось создать миниатюру ключа.', error); }
    if (!result) return null;
    inventoryImages.set(signature, result);
    if (inventoryImages.size > 48) inventoryImages.delete(inventoryImages.keys().next().value);
    return result;
  }

  function update() {
    const progress = getProgress(state);
    $('hand-count').textContent = `${state.held.length} / ${MAX_HELD}`;
    const inventory = $('inventory');
    inventory.replaceChildren();
    for (let slot = 0; slot < MAX_HELD; slot++) {
      const key = keyIndex.get(state.held[slot]);
      const element = document.createElement('div');
      element.className = `inventory-slot${key && slot === state.selected ? ' selected' : ''}${key?.broken ? ' broken' : ''}${key?.mud ? ' muddy' : ''}${key?.rust ? ' rusty' : ''}`;
      element.innerHTML = `<span class="slot-num">${slot + 1}</span>`;
      if (key) {
        const image = thumbnail(key);
        const visual = document.createElement(image ? 'img' : 'span');
        visual.className = image ? 'slot-thumbnail' : 'slot-mark';
        if (image) {
          visual.src = image;
          visual.alt = `Ключ «${KEY_TYPES[key.type].name}»`;
          visual.decoding = 'async';
          visual.draggable = false;
        } else visual.textContent = KEY_SYMBOLS[key.type];
        const name = document.createElement('span');
        name.className = 'slot-name';
        name.textContent = key.broken ? 'СЛОМАН · ПЛАВКА' : key.mud && key.rust ? 'ГРЯЗЬ + РЖАВЧИНА' :
          key.mud ? 'В ГРЯЗИ · ВОДА' : key.rust ? 'РЖАВЧИНА · РАСТВОР' : KEY_TYPES[key.type].name;
        element.title = name.textContent;
        element.append(visual, name);
      }
      inventory.append(element);
    }
    world.refreshHand(selectedKey(state));
  }
  return { update };
}
