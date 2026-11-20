const VOLUME_KEY = 'keynlock-archive-music-volume-v1';
const POSITION_KEY = 'keynlock-archive-music-position-v1';
const SAVE_INTERVAL_MS = 800;
const DEFAULT_VOLUME = 28;
const TRACKS = [
  new URL('../assets/music/chopin-nocturne-op9-no1.mp3', import.meta.url).href,
  new URL('../assets/music/chopin-nocturne-op9-no2.mp3', import.meta.url).href,
  new URL('../assets/music/chopin-nocturne-b-flat-minor.mp3', import.meta.url).href,
];

export function createArchiveMusic(browserWindow, storage) {
  let volume = DEFAULT_VOLUME;
  try {
    const saved = storage?.getItem(VOLUME_KEY);
    if (saved !== null && saved !== undefined && /^\d+$/.test(saved))
      volume = Math.min(100, Number(saved));
  } catch { /* storage is optional */ }

  let audio, track = 0, failed = 0;
  let resumeAt = 0, lastPositionSave = 0;
  let loadingResume = false, resumeUrl;
  try {
    const saved = JSON.parse(storage?.getItem(POSITION_KEY) ?? 'null');
    const savedTrack = TRACKS.findIndex(url => url.endsWith('/' + saved?.track));
    if (savedTrack >= 0 && Number.isFinite(saved.seconds) && saved.seconds >= 0) {
      track = savedTrack;
      resumeAt = saved.seconds;
    }
  } catch { /* storage is optional */ }
  let enabled = false;
  const { document } = browserWindow;

  function savePosition(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    try {
      storage?.setItem(POSITION_KEY, JSON.stringify({
        track: TRACKS[track].split('/').at(-1), seconds,
      }));
    } catch { /* storage is optional */ }
  }

  function checkpoint() {
    if (audio?.readyState > 0 && !resumeAt && !audio.seeking && !audio.error && !audio.ended)
      savePosition(audio.currentTime);
  }

  function playCurrent() {
    if (!audio || !enabled || !volume || document.hidden || loadingResume || failed >= TRACKS.length) return;
    try { audio.play()?.catch(() => {}); } catch { /* browser playback policy */ }
  }

  function setSource(url) {
    audio.src = url;
    if (resumeAt) try { audio.currentTime = resumeAt; } catch { /* metadata will seek */ }
    playCurrent();
  }

  function next() {
    if (resumeUrl) {
      browserWindow.URL.revokeObjectURL(resumeUrl);
      resumeUrl = undefined;
    }
    track = (track + 1) % TRACKS.length;
    resumeAt = 0;
    savePosition(0);
    setSource(TRACKS[track]);
  }

  function start() {
    enabled = true;
    if (!volume || !browserWindow.Audio) return;
    if (!audio) {
      audio = new browserWindow.Audio();
      audio.preload = 'none';
      audio.volume = volume / 100;
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
      audio.addEventListener('ended', () => {
        failed = 0;
        next();
      });
      audio.addEventListener('error', () => {
        failed++;
        if (failed < TRACKS.length) next();
      });
      const url = TRACKS[track];
      if (resumeAt && browserWindow.fetch && browserWindow.URL?.createObjectURL) {
        // The static host serves complete tracks without HTTP byte ranges.
        // A Blob URL lets the media element seek locally before any sound plays.
        playCurrent();
        loadingResume = true;
        browserWindow.fetch(url).then(response => {
          if (!response.ok) throw new Error('Could not load music');
          return response.blob();
        }).then(blob => {
          resumeUrl = browserWindow.URL.createObjectURL(blob);
        }).catch(() => { /* try the original URL if the fetch fails */ }).finally(() => {
          loadingResume = false;
          setSource(resumeUrl ?? url);
        });
        return;
      }
      setSource(url);
      return;
    } else if (failed >= TRACKS.length) {
      failed = 0;
      audio.src = TRACKS[track];
    }
    playCurrent();
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
    getVolume: () => volume,
    setVolume(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      volume = Math.min(100, Math.max(0, Math.round(number)));
      try { storage?.setItem(VOLUME_KEY, String(volume)); } catch { /* storage is optional */ }
      if (audio) audio.volume = volume / 100;
      if (volume && enabled) {
        if (!audio) start();
        else if (audio.paused) playCurrent();
      } else if (!volume) {
        checkpoint();
        audio?.pause();
      }
    },
  };
}
