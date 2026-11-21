// @ts-check
// The Archive plays the game's shared music player (music-player.js, a mirror
// of js/3d/core/audio) through its ceiling speakers (archive-music-mix.js).
// The track, playhead, volume and play/pause are the same saves the Lair uses.
import { createArchiveMusicMix } from './archive-music-mix.js';
import { getSharedMusicPlayer } from './music-player.js';
import { musicTracksWithUrls } from './music-tracks.js';

const tracks = () => musicTracksWithUrls(file => new URL(`../assets/music/${file}`, import.meta.url).href);

export function createArchiveMusic(browserWindow, storage) {
  return getSharedMusicPlayer(browserWindow, storage, { tracks: tracks(), createMix: createArchiveMusicMix });
}
