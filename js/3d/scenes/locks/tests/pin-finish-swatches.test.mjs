import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinFinishSwatches } from '../src/js/ui/pin-finish-swatches.js';

test('painted pin selectors show five actual gouache samples and restore classic finishes', () => {
  const appended = [];
  let encoded = 0;
  const context = {
    drawImage() {},
    getImageData() {
      const data = new Uint8ClampedArray(96 * 96 * 4);
      for (let i = 0; i < data.length; i += 4) data.set([142, 123, 105, 255], i);
      return { data };
    },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
  };
  const document = { createElement(tag) {
    if (tag === 'button') return { dataset: {}, style: {}, setAttribute() {} };
    if (tag === 'canvas') return { getContext: () => context,
      toDataURL: () => `data:image/webp;base64,preview-${encoded++}` };
    if (tag === 'img') {
      const image = {};
      Object.defineProperty(image, 'src', { set() { image.onload(); } });
      return image;
    }
    throw new Error(`Unexpected DOM element: ${tag}`);
  } };
  const painter = createPinFinishSwatches({ document,
    container: { append: element => appended.push(element) },
    names: ['Медь', 'Чёрная', 'Сталь', 'Латунь', 'Золото'],
    originalImages: ['old0.webp', 'old1.webp', 'old2.webp', 'old3.webp', 'old4.webp'],
  });
  assert.equal(painter.buttons.length, 5);
  assert.ok(appended.every(button => button.style.backgroundImage.includes('data:image/webp')));
  assert.equal(new Set(appended.map(button => button.style.backgroundImage)).size, 5);
  painter.update(false, .95);
  assert.equal(appended[3].style.backgroundImage, 'url("old3.webp")');
  painter.update(true, .95);
  assert.ok(appended[3].style.backgroundImage.includes('data:image/webp'));
});
