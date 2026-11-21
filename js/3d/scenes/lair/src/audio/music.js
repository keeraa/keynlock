// @ts-check
import { getSharedMusicPlayer } from '../../../../core/audio/music-player.js';
import { mountMusicControls } from '../../../../core/audio/music-controls.js';
import { musicTracksWithUrls } from '../../../../core/audio/music-tracks.js';
import { t, translator } from '../i18n.js';

// The Lair plays the game's shared music player (core/audio): the same tracks,
// saved playhead and play/pause as the Key Archive. The workshops live in this
// page, so the music goes on in the Atelier, the lab and the workbench.
// The recordings are the Archive's files; Vite copies them into the build.
const URLS = Object.freeze({
  'chopin-nocturne-op9-no1.mp3': new URL('../../../key-archive/dist/assets/music/chopin-nocturne-op9-no1.mp3', import.meta.url).href,
  'chopin-nocturne-op9-no2.mp3': new URL('../../../key-archive/dist/assets/music/chopin-nocturne-op9-no2.mp3', import.meta.url).href,
  'chopin-nocturne-b-flat-minor.mp3': new URL('../../../key-archive/dist/assets/music/chopin-nocturne-b-flat-minor.mp3', import.meta.url).href,
});

const labels = () => ({
  region: t('Музыка'), previous: t('Предыдущий трек'), next: t('Следующий трек'),
  play: t('Включить музыку'), pause: t('Пауза'), volume: t('Громкость музыки'),
});

/**
 * Creates the page's player, mounts its controls into each given element and
 * lets the music start on the first click or key press (browsers need one).
 * @param {{ window: Window, storage?: Storage | null, mounts: { element: HTMLElement | null, volume?: boolean }[] }} options
 */
export function mountLairMusic({ window: browserWindow, storage, mounts }) {
  const music = getSharedMusicPlayer(browserWindow, storage, {
    tracks: musicTracksWithUrls(file => URLS[file]),
  });
  for (const { element, volume } of mounts)
    if (element) mountMusicControls(element, music, { labels: labels(), language: translator.language, volume });
  const begin = event => {
    // The controls start the player themselves (a click on pause must not play first).
    if (event.target instanceof Element && event.target.closest('.music-controls')) return;
    music.start();
    browserWindow.removeEventListener('pointerdown', begin, true);
    browserWindow.removeEventListener('keydown', begin, true);
  };
  browserWindow.addEventListener('pointerdown', begin, true);
  browserWindow.addEventListener('keydown', begin, true);
  return music;
}
