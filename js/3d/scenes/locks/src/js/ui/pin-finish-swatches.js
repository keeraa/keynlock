import { paintTexturePixels, PIN_FINISH_TINTS, PIN_PAINT_CONTRAST,
  pinPaintBrightness } from '../effects/painted-materials.js';

/** The five UI samples use the same gouache pigment calculation as the 3D pins. */
export function createPinFinishSwatches({ document, container, names, originalImages }) {
  const buttons = names.map((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pin-finish';
    button.dataset.finish = String(index);
    button.title = name;
    button.setAttribute('aria-label', name);
    container.append(button);
    return button;
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const source = document.createElement('img');
  let pigment = null;
  let active = true;
  let strength = .95;
  let cachedStrength = -1;
  let cachedImages = [];

  function update(enabled, nextStrength) {
    active = Boolean(enabled) && nextStrength > 0;
    strength = nextStrength;
    if (active && pigment && context && strength !== cachedStrength) {
      cachedImages = PIN_FINISH_TINTS.map(tint => {
        const painted = paintTexturePixels(pigment, strength, tint,
          pinPaintBrightness(strength), PIN_PAINT_CONTRAST);
        const frame = context.createImageData(canvas.width, canvas.height);
        frame.data.set(painted);
        context.putImageData(frame, 0, 0);
        return `url("${canvas.toDataURL('image/webp', .87)}")`;
      });
      cachedStrength = strength;
    }
    buttons.forEach((button, index) => {
      if (!active) {
        button.style.backgroundImage = `url("${originalImages[index]}")`;
        return;
      }
      if (!pigment || !context) {
        button.style.backgroundImage = 'url("./assets/painted-pin.webp")';
        return;
      }
      button.style.backgroundImage = cachedImages[index];
    });
  }

  source.onload = () => {
    if (!context) return;
    try {
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      pigment = context.getImageData(0, 0, canvas.width, canvas.height).data;
      update(active, strength);
    } catch (error) {
      console.warn('Не удалось подготовить миниатюры штифтов:', error);
    }
  };
  source.src = './assets/painted-pin.webp';
  update(active, strength);
  return { buttons, update };
}
