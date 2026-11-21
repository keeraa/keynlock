import { t } from '../i18n.js';

/** Procedural room sound starts on a user gesture and pauses in hidden tabs. */
export function mountAmbience(button) {
  let context = null;
  const isEnabled = () => button.getAttribute('aria-pressed') === 'true';

  async function toggle() {
    const enable = !isEnabled();
    button.setAttribute('aria-pressed', String(enable));
    button.title = enable ? t('Выключить звуковое окружение') : t('Включить звуковое окружение');
    if (!context) {
      context = new AudioContext();
      const length = context.sampleRate * 3;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let seed = 98;
      for (let i = 0; i < length; i++) {
        seed = (1103515245 * seed + 12345) & 0x7fffffff;
        samples[i] = (seed / 0x7fffffff * 2 - 1) * .22;
      }
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 340;
      const gain = context.createGain(); gain.gain.value = .028;
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
    }
    if (enable && !document.hidden) await context.resume(); else await context.suspend();
  }

  button.addEventListener('click', toggle);
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) context.suspend();
    else if (isEnabled()) context.resume();
  });
}
