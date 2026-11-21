// @ts-check
/**
 * The player's controls as plain DOM, for any scene: previous, play/pause,
 * next, the track's title and (optionally) volume. Several can show the same
 * player; each follows it through subscribe. Styling is the scene's: the
 * elements carry .music-controls__* classes and data-playing on the root.
 *
 *   mountMusicControls(element, music, { labels, language, volume: true });
 */

/** @type {Readonly<Record<'region' | 'previous' | 'next' | 'play' | 'pause' | 'volume', string>>} */
const DEFAULT_LABELS = Object.freeze({
  region: 'Музыка', previous: 'Предыдущий трек', next: 'Следующий трек',
  play: 'Включить музыку', pause: 'Пауза', volume: 'Громкость музыки',
});

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof import('./music-player.js').createMusicPlayer>} music
 * @param {{ labels?: Partial<typeof DEFAULT_LABELS>, language?: string, volume?: boolean }} [options]
 * @returns {() => void} unmount
 */
export function mountMusicControls(root, music, { labels = {}, language = 'ru', volume = false } = {}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const doc = root.ownerDocument;
  const make = (tag, className, props = {}) => Object.assign(doc.createElement(tag), { className, ...props });

  root.classList.add('music-controls');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', text.region);
  const previous = make('button', 'music-controls__button music-controls__previous', { type: 'button', textContent: '⏮' });
  const toggle = make('button', 'music-controls__button music-controls__toggle', { type: 'button' });
  const next = make('button', 'music-controls__button music-controls__next', { type: 'button', textContent: '⏭' });
  const title = make('span', 'music-controls__title');
  title.setAttribute('aria-live', 'polite');
  previous.setAttribute('aria-label', text.previous);
  next.setAttribute('aria-label', text.next);
  previous.title = text.previous;
  next.title = text.next;
  previous.addEventListener('click', () => { music.start(); music.previous(); });
  next.addEventListener('click', () => { music.start(); music.next(); });
  toggle.addEventListener('click', () => {
    const { stopped, volume: level } = music.getState();
    if (!level) { music.setVolume(25); music.play(); }    // muted: "play" means sound again
    else music.toggle();
    if (stopped || !level) music.start();
  });
  const parts = [previous, toggle, next, title];

  let slider;
  if (volume) {
    slider = make('input', 'music-controls__volume', { type: 'range', min: '0', max: '100', step: '1' });
    slider.setAttribute('aria-label', text.volume);
    slider.title = text.volume;
    slider.addEventListener('input', () => { music.start(); music.setVolume(slider.value); });
    parts.push(slider);
  }
  root.replaceChildren(...parts);

  const unsubscribe = music.subscribe(state => {
    const on = !state.stopped && state.volume > 0;
    root.dataset.playing = String(state.playing);
    toggle.textContent = on ? '❚❚' : '▶';
    toggle.setAttribute('aria-label', on ? text.pause : text.play);
    toggle.title = on ? text.pause : text.play;
    toggle.setAttribute('aria-pressed', String(on));
    const name = state.title?.[language] ?? state.title?.ru ?? state.file;
    title.textContent = name;
    title.title = name;
    if (slider && doc.activeElement !== slider) slider.value = String(state.volume);
  });
  return () => { unsubscribe(); root.replaceChildren(); };
}
