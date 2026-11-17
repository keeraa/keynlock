import assert from 'node:assert/strict';
import test from 'node:test';
import { createRestorationFeedback } from '../integrations/atelier/src/restoration-feedback.js';
import { createWoodStyle } from '../integrations/atelier/src/wood-style.js';

function element() {
  const listeners = new Map();
  return {
    value: '', textContent: '', style: {}, firstChild: { textContent: '' },
    addEventListener(type, fn) { listeners.set(type, fn); },
    dispatch(type, value) { listeners.get(type)?.({ target: { value } }); },
  };
}

test('three Atelier sliders update their displayed values, saved state, shader and score', () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const painting = { id: 'vangogh-self', short: 'Автопортрет', hue: 29, saturation: .82, brightness: .84 };
  const player = { hue: 0, saturation: 100, brightness: 100 };
  let saves = 0;
  const material = { uniforms: { uHue: { value: null }, uSaturation: { value: null }, uBrightness: { value: null } } };
  const controls = createRestorationFeedback({
    paintings: [painting], getSelectedIndex: () => 0, getSurface: () => null,
    getCopyMaterial: () => material, getCurrentTool: () => null,
    playerProgress: { state: [player], save: () => { saves++; } },
    onRestorationComplete: () => {}, showToast: () => {}, $,
  });
  controls.bindControls();
  controls.updateUI();
  assert.equal(material.uniforms.uHue.value, 29);
  assert.notEqual($('score-number').textContent, '—');
  $('hue').dispatch('input', '-14');
  $('saturation').dispatch('input', '115');
  $('brightness').dispatch('input', '125');
  assert.deepEqual([player.hue,player.saturation,player.brightness],[-14,115,125]);
  assert.equal($('hue-value').textContent, '-14°');
  assert.equal($('saturation-value').textContent, '115%');
  assert.equal($('brightness-value').textContent, '125%');
  assert.equal(material.uniforms.uHue.value, 15);
  assert.ok(Math.abs(material.uniforms.uSaturation.value - .82 * 1.15) < 1e-10);
  assert.ok(Math.abs(material.uniforms.uBrightness.value - .84 * 1.25) < 1e-10);
  assert.equal($('score-fill').style.width, `${$('score-number').textContent}%`);
  assert.ok(saves >= 3, 'changing each slider saves its value');
});

test('each wood swatch works despite another failed asset; wallpaper initializes independently', async () => {
  const buttons = ['easel','frame'].flatMap(target => [0,1,2].map(index => {
    const node = element();
    node.dataset = { target, wood: String(index) };
    node.classList = { toggle(name, active) { node[name] = active; } };
    node.setAttribute = (name, value) => { node[name] = value; };
    return node;
  }));
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === '.wood-option') return buttons;
      const target = selector.match(/data-target="([^"]+)"/)?.[1];
      return buttons.filter(node => node.dataset.target === target);
    },
  };
  try {
    const texture = (name) => ({ name, colorSpace: null, repeat: { set() {} },
      center: { set() {} }, clone() { return texture(`${name}-clone`); } });
    const loader = { loadAsync: async (name) => {
      if (name.includes('wood-walnut')) throw Error('Walnut image unavailable');
      return texture(name);
    } };
    const color = () => ({ value: null, set(value) { this.value = value; } });
    const materials = Object.fromEntries(['easel','easelEdge','deepWood','frameWood','roomWood','roomEdge']
      .map(name => [name, { color: color(), needsUpdate: false, map: null }]));
    const wallpaperMaterial = { color: color(), map: null, needsUpdate: false };
    const style = createWoodStyle({
      THREE: { SRGBColorSpace: 'sRGB', RepeatWrapping: 1, ClampToEdgeWrapping: 2 },
      renderer: { capabilities: { getMaxAnisotropy: () => 8 } },
      loader, mats: materials, wallpaperMaterial, floorWoodMaterials: [],
      variants: [{ name: 'Охра', image: 'oak' }, { name: 'Орех', image: 'walnut' }, { name: 'Пепел', image: 'ash' }],
    });
    style.setVariant('easel', 0);
    assert.equal(materials.easel.color.value, '#c38e58', 'fallback swatches work before image downloads');
    await style.initialize();
    assert.equal(wallpaperMaterial.map.name, '/stations/atelier/textures/atelier-wallpaper-gouache.webp');
    assert.equal(wallpaperMaterial.color.value, '#ffffff');
    style.setVariant('easel',1);
    assert.equal(materials.easel.map, null, 'missing walnut uses safe fallback');
    assert.ok(materials.frameWood.map.name.includes('wood-ash'), 'another swatch still renders');
    buttons.find(node => node.dataset.target === 'easel' && node.dataset.wood === '2').dispatch('click');
    assert.ok(materials.easel.map.name.includes('wood-ash'), 'easel button switches the real 3D material');
    buttons.find(node => node.dataset.target === 'frame' && node.dataset.wood === '0').dispatch('click');
    assert.ok(materials.frameWood.map.name.includes('wood-oak'), 'frame button switches the real 3D material');
    assert.equal(buttons.find(node => node.dataset.target === 'frame' && node.dataset.wood === '0')['aria-pressed'],'true');
  } finally {
    globalThis.document = originalDocument;
  }
});
