// @ts-check
/**
 * The game's one music player, shared by every scene: the Lair, its workshops,
 * the Key Archive and the scenes still to come. One page has one player
 * (getSharedMusicPlayer), so a workshop or a scene embedded in the Lair keeps
 * the music that is already playing. Separate pages continue where the last
 * one stopped: the track, the playhead, the volume and play/pause are saved
 * under the same keys everywhere (they kept the Key Archive's names, so its
 * players' saves carry over). Pages share them only on the same origin.
 *
 * Framework-free and Three-free. The Key Archive's copy is a mirror
 * (core/audio/sync.mjs); edit this file, then run the sync.
 *
 *   const music = getSharedMusicPlayer(window, localStorage, { tracks });
 *   music.start();            // after a user gesture
 *   music.next(); music.toggle(); music.subscribe(state => render(state));
 *
 * A scene may route the sound through its own Web Audio graph (the Archive's
 * ceiling speakers): createMix(context, audio, { volume, paused, spatial })
 * returns { resume, setVolume, setPaused, setSpatial, setListener }.
 */

export const MUSIC_STORAGE_KEYS = Object.freeze({
  volume: 'keynlock-archive-music-volume-v1',
  spatial: 'keynlock-archive-music-spatial-v1',
  position: 'keynlock-archive-music-position-v1',
  stopped: 'keynlock-music-stopped-v1',
});
const SAVE_INTERVAL_MS = 800;
const DEFAULT_VOLUME = 25;
const SHARED = Symbol.for('keynlock.music');

/**
 * @typedef {{ file: string, url: string, title?: Record<string, string> }} MusicTrack
 * @typedef {{ track: number, file: string, title?: Record<string, string>, playing: boolean,
 *   stopped: boolean, volume: number }} MusicState
 */

/** The page's player: created on the first call, the same object afterwards. */
export function getSharedMusicPlayer(browserWindow, storage, options) {
  const host = /** @type {any} */ (browserWindow);
  host[SHARED] ??= createMusicPlayer(browserWindow, storage, options);
  return host[SHARED];
}

/**
 * @param {any} browserWindow
 * @param {Storage | undefined | null} storage
 * @param {{ tracks: MusicTrack[], createMix?: Function }} options
 */
export function createMusicPlayer(browserWindow, storage, { tracks, createMix }) {
  if (!tracks?.length) throw new Error('The music player needs at least one track.');
  const KEYS = MUSIC_STORAGE_KEYS;
  const read = key => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
  const write = (key, value) => { try { storage?.setItem(key, value); } catch { /* storage is optional */ } };

  let volume = DEFAULT_VOLUME;
  const savedVolume = read(KEYS.volume);
  if (savedVolume !== null && /^\d+$/.test(savedVolume)) volume = Math.min(100, Number(savedVolume));
  let spatial = read(KEYS.spatial) !== '0';
  let stopped = read(KEYS.stopped) === '1';

  let audio, track = 0, failed = 0;
  let resumeAt = 0, lastPositionSave = 0;
  let loadingResume = false, resumeUrl;
  try {
    const saved = JSON.parse(read(KEYS.position) ?? 'null');
    const savedTrack = tracks.findIndex(item => item.file === saved?.track);
    if (savedTrack >= 0 && Number.isFinite(saved.seconds) && saved.seconds >= 0) {
      track = savedTrack;
      resumeAt = saved.seconds;
    }
  } catch { /* a broken save starts at the first track */ }
  let enabled = false;
  let paused = false;
  let mix;
  const listeners = new Set();
  const { document } = browserWindow;

  /** @returns {MusicState} */
  function state() {
    return {
      track, file: tracks[track].file, title: tracks[track].title,
      playing: Boolean(audio && !audio.paused), stopped, volume,
    };
  }
  function notify() {
    const current = state();
    for (const listener of listeners) try { listener(current); } catch { /* one view must not stop the rest */ }
  }

  function savePosition(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    write(KEYS.position, JSON.stringify({ track: tracks[track].file, seconds }));
  }

  function checkpoint() {
    if (audio?.readyState > 0 && !resumeAt && !audio.seeking && !audio.error && !audio.ended)
      savePosition(audio.currentTime);
  }

  function playCurrent() {
    if (!audio || !enabled || stopped || !volume || document.hidden || loadingResume || failed >= tracks.length) return;
    try { audio.play()?.catch(() => {}); } catch { /* browser playback policy */ }
  }

  function setSource(url) {
    audio.src = url;
    if (resumeAt) try { audio.currentTime = resumeAt; } catch { /* metadata will seek */ }
    playCurrent();
  }

  function releaseResumeUrl() {
    if (!resumeUrl) return;
    browserWindow.URL.revokeObjectURL(resumeUrl);
    resumeUrl = undefined;
  }

  /** Switch to track index (wrapping) from its start. */
  function select(index) {
    const count = tracks.length;
    const nextTrack = ((Math.trunc(Number(index)) % count) + count) % count;
    if (!Number.isFinite(nextTrack)) return;
    releaseResumeUrl();
    track = nextTrack;
    resumeAt = 0;
    savePosition(0);
    if (audio && !loadingResume) setSource(tracks[track].url);
    notify();
  }

  function initMix() {
    if (!createMix) return;
    const Context = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!Context) return;
    let context;
    try {
      context = new Context();
      mix = createMix(context, audio, { volume: volume / 100, paused, spatial });
    } catch {
      context?.close?.()?.catch(() => {});
    }
  }

  function createAudio() {
    audio = new browserWindow.Audio();
    audio.preload = 'none';
    audio.volume = volume / 100;
    initMix();
    mix?.resume();
    audio.addEventListener('loadedmetadata', () => {
      if (!resumeAt) return;
      const end = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - .05) : resumeAt;
      const target = Math.min(resumeAt, end);
      try {
        if (Math.abs(audio.currentTime - target) > .08) audio.currentTime = target;
        resumeAt = 0;
      } catch { /* the pending position is kept until the next load */ }
    });
    audio.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastPositionSave < SAVE_INTERVAL_MS) return;
      lastPositionSave = now;
      checkpoint();
    });
    audio.addEventListener('play', notify);
    audio.addEventListener('pause', notify);
    audio.addEventListener('ended', () => {
      failed = 0;
      select(track + 1);
    });
    audio.addEventListener('error', () => {
      failed++;
      if (failed < tracks.length) select(track + 1);
    });
    const url = tracks[track].url;
    if (resumeAt && browserWindow.fetch && browserWindow.URL?.createObjectURL) {
      // Static hosts may serve whole files without HTTP byte ranges. A Blob
      // URL lets the media element seek locally before any sound plays.
      playCurrent();
      loadingResume = true;
      const pendingTrack = track;
      browserWindow.fetch(url).then(response => {
        if (!response.ok) throw new Error('Could not load music');
        return response.blob();
      }).then(blob => {
        if (track === pendingTrack) resumeUrl = browserWindow.URL.createObjectURL(blob);
      }).catch(() => { /* try the original URL if the fetch fails */ }).finally(() => {
        loadingResume = false;
        setSource(resumeUrl ?? tracks[track].url);
      });
      return;
    }
    setSource(url);
  }

  /** Allow sound (call from a user gesture); plays unless the player chose pause. */
  function start() {
    enabled = true;
    if (!volume || !browserWindow.Audio) return;
    if (stopped) { notify(); return; }
    if (!audio) { createAudio(); notify(); return; }
    if (failed >= tracks.length) {
      failed = 0;
      audio.src = tracks[track].url;
    }
    mix?.resume();
    playCurrent();
  }

  function setStopped(value) {
    stopped = Boolean(value);
    write(KEYS.stopped, stopped ? '1' : '0');
    if (stopped) {
      checkpoint();
      audio?.pause();
    } else start();
    notify();
  }

  browserWindow.addEventListener('pagehide', checkpoint);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      checkpoint();
      audio?.pause();
    } else playCurrent();
  });

  return {
    start,
    tracks: Object.freeze(tracks.slice()),
    getState: state,
    /** Calls listener now and after every change; returns the unsubscribe. */
    subscribe(listener) {
      listeners.add(listener);
      listener(state());
      return () => listeners.delete(listener);
    },
    next: () => select(track + 1),
    previous: () => select(track - 1),
    select,
    play: () => setStopped(false),
    pause: () => setStopped(true),
    toggle: () => setStopped(!stopped),
    getVolume: () => volume,
    setVolume(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      volume = Math.min(100, Math.max(0, Math.round(number)));
      write(KEYS.volume, String(volume));
      if (mix) mix.setVolume(volume / 100);
      else if (audio) audio.volume = volume / 100;
      if (volume && enabled) {
        if (!audio) start();
        else if (audio.paused) playCurrent();
      } else if (!volume) {
        checkpoint();
        audio?.pause();
      }
      notify();
    },
    getSpatial: () => spatial,
    setSpatial(value) {
      spatial = Boolean(value);
      write(KEYS.spatial, spatial ? '1' : '0');
      mix?.setSpatial(spatial);
    },
    /** A scene's menu dims the mix (the Archive's pause filter); playback goes on. */
    setPaused(value) {
      const next = Boolean(value);
      if (next === paused) return;
      paused = next;
      mix?.setPaused(paused);
    },
    setListener(position, forward, up) { if (spatial) mix?.setListener(position, forward, up); },
  };
}
