import { KEY_TYPES, MAX_HELD, getProgress, selectedKey } from './rules.js?v=key-ring';
import { thumbnailCacheKey } from './key-thumbnails.js?v=key-ring';
import { createKeyFallbackStamp } from './key-factory.js?v=key-ring';

export const KEY_SYMBOLS = Object.freeze(['◯', '⌃', '□', '◇', '⚙', '⬡', '★', '✿', '⬭', '∞']);

export function createArchiveHud(document, world, state, keyIndex) {
  const $ = id => document.getElementById(id);
  const inventoryImages = new Map();
  const bundleArt = document.querySelector('.bundle-art');
  let renderedBundle;
  let sway = 0, walkPhase = 0;

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
    const resources = $('archive-resources');
    if (resources) resources.textContent = `Металл ${state.metal ?? 0}${state.bundles ? ' · Кольцо куплено' : ''}`;
    const bundle = $('carried-bundle');
    const label = $('bundle-label');
    const icons = $('bundle-keys');
    if (bundle && label && icons && renderedBundle !== state.activeBundle) {
      renderedBundle = state.activeBundle;
      bundle.hidden = !renderedBundle;
      label.textContent = renderedBundle ? `В связке · ${KEY_TYPES[renderedBundle.type].name} ×4` : '';
      icons.replaceChildren();
      const positions = [[40,22,23],[47,27,9],[56,28,-9],[64,21,-25]];
      renderedBundle?.ids.forEach((id,index) => {
        const key = keyIndex.get(id);
        const picture = key && thumbnail(key);
        const icon = document.createElement(picture ? 'img' : 'span');
        if (picture) { icon.src = picture; icon.alt = ''; }
        else icon.textContent = '⚿';
        const [x,y,angle] = positions[index];
        icon.style.setProperty('--key-x', `${x}px`);
        icon.style.setProperty('--key-y', `${y}px`);
        icon.style.setProperty('--key-angle', `${angle}deg`);
        icons.append(icon);
      });
    }
    const inventory = $('inventory');
    inventory.replaceChildren();
    for (let slot = 0; slot < MAX_HELD; slot++) {
      const key = keyIndex.get(state.held[slot]);
      const element = document.createElement('div');
      element.className = `inventory-slot${key && slot === state.selected ? ' selected' : ''}${key?.broken ? ' broken' : ''}${key?.mud ? ' muddy' : ''}${key?.rust ? ' rusty' : ''}${key?.wax ? ' waxed' : ''}`;
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
        name.textContent = key.broken ? 'СЛОМАН · ПЛАВКА' : key.wax ? 'ВОСК · СВЕЧА' : key.mud && key.rust ? 'ГРЯЗЬ + РЖАВЧИНА' :
          key.mud ? 'В ГРЯЗИ · ВОДА' : key.rust ? 'РЖАВЧИНА · РАСТВОР' : KEY_TYPES[key.type].name;
        element.title = name.textContent;
        element.append(visual, name);
      }
      inventory.append(element);
    }
    world.refreshHand(selectedKey(state));
  }
  function walk(distance, delta) {
    if (!bundleArt || !state.activeBundle) { sway = 0; return; }
    if (!distance && sway < .005) return;
    walkPhase += distance * 2.7;
    const speed = Math.min(1, distance / Math.max(.001, delta) / 4.4);
    sway += (speed - sway) * (1 - Math.exp(-delta * 6));
    bundleArt.style.setProperty('--bundle-tilt', `${Math.sin(walkPhase) * sway * 1.55}deg`);
    bundleArt.style.setProperty('--bundle-bob', `${Math.sin(walkPhase * 2) * sway * .72}px`);
  }
  return { update, walk };
}
