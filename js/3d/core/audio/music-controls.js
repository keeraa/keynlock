// @ts-check
/**
 * The player's controls as plain DOM, for any scene: previous, play/pause,
 * next, the track's title, (optionally) volume and the playlist. Several can
 * show the same player; each follows it through subscribe. Styling is the
 * scene's: the elements carry .music-controls__* classes, data-playing on the
 * root and aria-current on the playing track.
 *
 *   mountMusicControls(element, music, { labels, language, volume: true, playlist: 'list' });
 *
 * playlist: 'list' shows every track under the controls; 'menu' turns the
 * title into a button that opens the list; false (default) shows no list.
 */

/** @type {Readonly<Record<'region' | 'previous' | 'next' | 'play' | 'pause' | 'volume' | 'playlist', string>>} */
const DEFAULT_LABELS = Object.freeze({
  region: 'Музыка', previous: 'Предыдущий трек', next: 'Следующий трек',
  play: 'Включить музыку', pause: 'Пауза', volume: 'Громкость музыки', playlist: 'Плейлист',
});

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof import('./music-player.js').createMusicPlayer>} music
 * @param {{ labels?: Partial<typeof DEFAULT_LABELS>, language?: string, volume?: boolean,
 *   playlist?: false | 'list' | 'menu' }} [options]
 * @returns {() => void} unmount
 */
export function mountMusicControls(root, music, { labels = {}, language = 'ru', volume = false, playlist = false } = {}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const doc = root.ownerDocument;
  const make = (tag, className, props = {}) => Object.assign(doc.createElement(tag), { className, ...props });
  const trackName = track => track.title?.[language] ?? track.title?.ru ?? track.file;

  root.classList.add('music-controls');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', text.region);
  const previous = make('button', 'music-controls__button music-controls__previous', { type: 'button', textContent: '⏮' });
  const toggle = make('button', 'music-controls__button music-controls__toggle', { type: 'button' });
  const next = make('button', 'music-controls__button music-controls__next', { type: 'button', textContent: '⏭' });
  const title = make(playlist === 'menu' ? 'button' : 'span', 'music-controls__title');
  if (playlist !== 'menu') title.setAttribute('aria-live', 'polite');
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

  /** @type {HTMLOListElement | null} */
  let list = null;
  const items = [];
  const setListOpen = open => {
    if (!list || playlist !== 'menu') return;
    list.hidden = !open;
    title.setAttribute('aria-expanded', String(open));
  };
  const onOutside = event => { if (list && !list.hidden && !root.contains(event.target)) setListOpen(false); };
  const onKey = event => { if (event.key === 'Escape' && list && !list.hidden) setListOpen(false); };
  if (playlist) {
    list = make('ol', `music-controls__playlist music-controls__playlist--${playlist}`);
    list.setAttribute('aria-label', text.playlist);
    music.tracks.forEach((track, index) => {
      const item = make('li', 'music-controls__track');
      const button = make('button', 'music-controls__track-button', { type: 'button', textContent: trackName(track) });
      button.addEventListener('click', () => {
        music.start();
        if (music.getState().track !== index) music.select(index);
        if (music.getState().stopped) music.play();
        setListOpen(false);
      });
      item.append(button);
      items.push(item);
      list.append(item);
    });
    parts.push(list);
    if (playlist === 'menu') {
      title.setAttribute('aria-haspopup', 'true');
      title.title = text.playlist;
      title.addEventListener('click', () => setListOpen(list.hidden));
      doc.addEventListener('pointerdown', onOutside);
      doc.addEventListener('keydown', onKey);
      setListOpen(false);
    }
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
    title.textContent = playlist === 'menu' ? `${name} ▾` : name;
    if (playlist !== 'menu') title.title = name;
    else title.setAttribute('aria-label', `${text.playlist}: ${name}`);
    items.forEach((item, index) => {
      if (index === state.track) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    if (slider && doc.activeElement !== slider) slider.value = String(state.volume);
  });
  return () => {
    unsubscribe();
    doc.removeEventListener('pointerdown', onOutside);
    doc.removeEventListener('keydown', onKey);
    root.replaceChildren();
  };
}
