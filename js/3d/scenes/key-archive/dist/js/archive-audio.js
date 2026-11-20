// Short, procedural Foley. Clips are generated once per session and reused.
const SAMPLE_RATE = 24000;
const EFFECT_LEVEL = { water: .47, waxStart: .42, waxDone: .52, melt: .19 };
const SOUND_KEY = 'keynlock-archive-sound-v1';

// Each layer is a decaying impact or a filtered burst of noise. Offsets give
// keys their loose metallic rattle and let water and the forge trail off.
const ring = (frequency, length, level, at = 0, bend = 0) =>
  ({ frequency, length, level, at, bend });
const noise = (low, high, length, level, at = 0, attack = .003) =>
  ({ low, high, length, level, at, attack });

const CLIPS = {
  take: [noise(1450, 4800, .045, .25), ring(1390, .13, .19), ring(2320, .09, .12, .029), ring(3020, .062, .09, .045)],
  release: [noise(680, 3300, .064, .11), ring(1770, .075, .11, .015)],
  dropWood: [noise(420, 4700, .075, .36), ring(770, .095, .21), ring(1800, .17, .20),
    ring(2410, .115, .13, .16), ring(1670, .09, .085, .25)],
  dropRug: [noise(95, 840, .12, .31), ring(106, .083, .23), ring(1420, .078, .15), ring(1930, .085, .065, .13)],
  stepWood: [noise(95, 850, .14, .25), ring(116, .105, .21, 0, 40), noise(660, 1950, .063, .12, .065)],
  stepRug: [noise(75, 480, .13, .21), ring(87, .075, .16, 0, 23), noise(360, 1300, .10, .18, .042)],
  place: [noise(240, 1650, .072, .25), ring(265, .075, .17), ring(1300, .14, .20, .011), ring(2050, .083, .10, .030)],
  bundle: [noise(950, 4250, .14, .24), ring(1050, .16, .17), ring(1610, .13, .16, .048), ring(1990, .095, .13, .091)],
  water: [noise(390, 2370, .23, .38), noise(1200, 4500, .098, .15, .058),
    ring(340, .085, .16, .035, -170), ring(465, .058, .10, .135, -260)],
  rust: [noise(690, 6400, .31, .29, 0, .022), ring(285, .07, .15, .032, -190),
    ring(390, .075, .11, .106, -300), ring(560, .09, .072, .18, -380)],
  lift: [noise(430, 2200, .17, .20), ring(690, .065, .11, .056, 270), ring(1320, .14, .13, .02)],
  ready: [ring(620, .23, .16), ring(930, .20, .10, .08)],
  waxStart: [noise(1700, 5100, 2.65, .16, 0, .045), noise(1000, 4200, 2.37, .10, .21, .11)],
  waxDone: [ring(530, .084, .15, 0, 190), ring(1440, .16, .13, .047), noise(1400, 3200, .09, .12, .025)],
  melt: [noise(120, 1520, .33, .38), ring(130, .25, .22, 0, 72), ring(375, .19, .14),
    noise(1120, 5150, .52, .25, .09, .070), noise(2600, 6200, .035, .17, .26), noise(1900, 5200, .049, .12, .39)],
  row: [ring(660, .24, .19), ring(990, .26, .15, .09), ring(1510, .19, .046, .058)],
  finish: [ring(392, .38, .22), ring(587, .34, .17, .105), ring(784, .43, .15, .205),
    ring(1584, .27, .07, .210), ring(1176, .33, .075, .28)],
  wrong: [noise(180, 1040, .095, .18), ring(157, .12, .16, 0, 40), ring(289, .13, .08)],
};

function makeClip(context, layers) {
  const duration = Math.max(...layers.map(layer => layer.at + layer.length));
  const clip = context.createBuffer(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const samples = clip.getChannelData(0);
  let seed = 90230;
  for (const layer of layers) {
    const start = Math.round(layer.at * SAMPLE_RATE);
    let high = 0, low = 0;
    const highRate = 1 - Math.exp(-2 * Math.PI * (layer.high ?? 1) / SAMPLE_RATE);
    const lowRate = 1 - Math.exp(-2 * Math.PI * (layer.low ?? 1) / SAMPLE_RATE);
    for (let i = 0; i < layer.length * SAMPLE_RATE && start + i < samples.length; i++) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, t / (layer.attack ?? .003));
      const envelope = attack * (1 - t / layer.length) ** 2.7;
      let signal;
      if (layer.frequency) {
        signal = Math.sin(2 * Math.PI * (layer.frequency - layer.bend * t / 2) * t);
      } else {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const sample = seed / 2147483648 - 1;
        high += (sample - high) * highRate;
        low += (sample - low) * lowRate;
        signal = (high - low) * 2;
      }
      samples[start + i] += signal * envelope * layer.level;
    }
  }
  return clip;
}

export function createArchiveAudio(browserWindow) {
  let muted = false;
  try { muted = browserWindow.localStorage?.getItem(SOUND_KEY) === 'off'; } catch { /* optional */ }
  let context, master;
  let playing = false;
  let stride = 0;
  let walking = false;
  let variation = 0;
  let waxVoice;
  const clips = new Map();
  const lastPlayed = new Map();
  const recordings = { stepWood: [], stepRug: [], waxStart: [], water: [] };
  function loadRecordings() {
    const paths = {
      stepWood: Array.from({ length: 4 }, (_, i) => `footsteps/wood-${i + 1}.wav`),
      stepRug: Array.from({ length: 4 }, (_, i) => `footsteps/rug-${i + 1}.wav`),
      waxStart: ['cleaning/wax-sizzle.wav'],
      water: ['cleaning/water-bubbles.wav'],
    };
    for (const [kind, files] of Object.entries(paths)) {
      for (const file of files) {
        const url = new URL(`../assets/${file}`, import.meta.url);
        browserWindow.fetch?.(url).then(response => {
          if (!response.ok) throw new Error('Recording unavailable');
          return response.arrayBuffer();
        }).then(bytes => context.decodeAudioData(bytes)).then(buffer => recordings[kind].push(buffer))
          .catch(() => {}); // Keep procedural effects while the recordings are unavailable.
      }
    }
  }

  function unlock() {
    if (muted) return;
    try {
      const AudioContext = browserWindow.AudioContext || browserWindow.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = playing ? .56 : 0;
        master.connect(context.destination);
        loadRecordings();
      }
      if (context.state === 'suspended') context.resume()?.catch(() => {});
    } catch { /* sound is optional */ }
  }

  function updateVolume() {
    if (!master) return;
    master.gain.setTargetAtTime(playing && !muted ? .56 : 0, context.currentTime, .012);
  }

  function clipFor(kind) {
    const samples = recordings[kind];
    if (samples?.length) return samples[variation % samples.length];
    if (!clips.has(kind)) clips.set(kind, makeClip(context, CLIPS[kind]));
    return clips.get(kind);
  }

  function setWaxMelting(active) {
    if (!active || muted || !playing || context?.state !== 'running') {
      if (!waxVoice) return;
      const { source, volume } = waxVoice;
      waxVoice = null;
      const now = context.currentTime;
      volume.gain.setTargetAtTime(0, now, .013);
      source.stop(now + .075);
      return;
    }
    if (waxVoice) return;
    try {
      const source = context.createBufferSource();
      const volume = context.createGain();
      source.buffer = clipFor('waxStart');
      source.loop = true;
      volume.gain.value = EFFECT_LEVEL.waxStart;
      source.connect(volume).connect(master);
      source.onended = () => { source.disconnect(); volume.disconnect(); };
      source.start();
      waxVoice = { source, volume };
    } catch { /* sound is optional */ }
  }

  // The rust solution hisses when a key touches it and the hiss slowly dies
  // away: the real sizzle recording (CC0, see assets/cleaning/LICENSE.txt),
  // pitched down and looped under a long decay, with a fine bubbling layer.
  const FIZZ_SECONDS = 5.5;
  function fizz(level = 1) {
    const sizzle = recordings.waxStart[0];
    if (!sizzle) return false;
    const now = context.currentTime;
    const layers = [
      { buffer: sizzle, rate: .82, gain: .5, attack: .035, decay: FIZZ_SECONDS },
      { buffer: recordings.water[0], rate: 1.7, gain: .16, attack: .25, decay: FIZZ_SECONDS * .75 },
    ];
    for (const layer of layers) {
      if (!layer.buffer) continue;
      const source = context.createBufferSource();
      const volume = context.createGain();
      source.buffer = layer.buffer;
      source.loop = true;
      source.playbackRate.value = layer.rate * (.97 + Math.random() * .06);
      // Starts on contact, then fades out gradually (exponential tail).
      volume.gain.setValueAtTime(0, now);
      volume.gain.linearRampToValueAtTime(layer.gain * Math.min(1, level), now + layer.attack);
      volume.gain.setTargetAtTime(0, now + layer.attack + .4, layer.decay / 4);
      source.connect(volume).connect(master);
      source.onended = () => { source.disconnect(); volume.disconnect(); };
      source.start(now, Math.random() * Math.max(0, layer.buffer.duration - .5));
      source.stop(now + layer.decay + 1);
    }
    return true;
  }

  function tone(kind, level = 1) {
    if (kind === 'rust' && !muted && playing && context?.state === 'running' && level > 0 && fizz(level)) return;
    if (muted || !playing || context?.state !== 'running' || !CLIPS[kind] || level <= 0) return;
    try {
      const now = context.currentTime;
      // A four-key bundle can make contact in a single frame. One sound is enough.
      if (now - (lastPlayed.get(kind) ?? -Infinity) < .045) return;
      lastPlayed.set(kind, now);
      const source = context.createBufferSource();
      const volume = context.createGain();
      source.buffer = clipFor(kind);
      source.playbackRate.value = ['finish', 'row', 'ready'].includes(kind)
        ? 1 : [1, .94, 1.06, .98, 1.03][variation++ % 5];
      volume.gain.value = Math.min(1, level) * (EFFECT_LEVEL[kind] ?? 1);
      source.connect(volume).connect(master);
      source.onended = () => { source.disconnect(); volume.disconnect(); };
      source.start();
    } catch { /* sound is optional */ }
  }

  function walk(distance, rug, running) {
    if (distance < .0001) {
      stride = 0;
      walking = false;
      return;
    }
    if (!walking) stride = running ? 1.6 : 1.32;
    walking = true;
    stride += distance;
    const interval = running ? 2.13 : 1.76;
    if (stride < interval) return;
    stride -= interval;
    tone(rug ? 'stepRug' : 'stepWood', running ? .415 : .33);
  }

  function setMuted(value) {
    muted = Boolean(value);
    try { browserWindow.localStorage?.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch { /* optional */ }
    updateVolume();
    if (muted) setWaxMelting(false);
    else unlock();
  }

  return {
    tone, walk, unlock, setMuted, setWaxMelting, isMuted: () => muted,
    setPlaying(value) {
      playing = Boolean(value);
      if (!playing) { walk(0); setWaxMelting(false); }
      updateVolume();
    },
  };
}
