import { makeClip, noise, ring } from './foley.js';

const surfaces = {
  wood: [noise(95, 850, .14, .25), ring(116, .105, .21, 0, 40), noise(660, 1950, .063, .12, .065)],
  rug: [noise(75, 480, .13, .21), ring(87, .075, .16, 0, 23), noise(360, 1300, .10, .18, .042)],
};
const playbackRates = [1, .94, 1.06, .98, 1.03];
const outputLevel = .56;
const sampleCount = 4;

function fetchStep(browserWindow, surface, index) {
  const url = new URL(`../assets/footsteps/${surface}-${index}.wav`, import.meta.url);
  return browserWindow.fetch?.(url)
    .then(response => response.ok ? response.arrayBuffer() : null)
    .catch(() => null) ?? Promise.resolve(null);
}

/** Footsteps advance by distance actually travelled, after collision checks. */
export function createFootsteps(browserWindow, { nextVariation } = {}) {
  // Load the WAV data while the scene starts; creating the audio context
  // still waits for a gesture.
  const recordings = Object.fromEntries(Object.keys(surfaces).map(surface => [surface, {
    requests: Array.from({ length: sampleCount }, (_, index) => fetchStep(browserWindow, surface, index + 1)),
    samples: Array(sampleCount).fill(null),
    pending: sampleCount,
  }]));
  const procedural = new Map();
  const lastPlayed = new Map();
  let context, output, ownsContext = false;
  let stride = 0, walking = false, playing = true, step = 0;

  function unlock(shared) {
    try {
      if (!context) {
        if (shared) {
          ({ context, output } = shared);
        } else {
          const AudioContext = browserWindow.AudioContext || browserWindow.webkitAudioContext;
          if (!AudioContext) return;
          context = new AudioContext();
          output = context.createGain();
          output.gain.value = playing ? outputLevel : 0;
          output.connect(context.destination);
          ownsContext = true;
        }
        for (const recording of Object.values(recordings)) {
          recording.requests.forEach((request, index) => {
            request.then(bytes => bytes && context.decodeAudioData(bytes)).then(buffer => {
              recording.samples[index] = buffer;
            }).catch(() => {}).finally(() => { recording.pending--; });
          });
        }
      }
      if (ownsContext && context.state === 'suspended') context.resume()?.catch(() => {});
    } catch { /* sound is optional */ }
  }

  function reset() {
    stride = 0;
    walking = false;
  }

  function setPlaying(value) {
    if (playing === value) return;
    playing = value;
    if (!playing) reset();
    if (ownsContext) output.gain.setTargetAtTime(playing ? outputLevel : 0, context.currentTime, .012);
  }

  function update(distance, surface, running) {
    if (!playing || distance < .0001) { reset(); return; }
    if (!walking) stride = running ? 1.6 : 1.32;
    walking = true;
    stride += distance;
    const interval = running ? 2.13 : 1.76;
    if (stride < interval) return;
    stride -= interval;
    if (context?.state !== 'running') return;

    try {
      const recording = recordings[surface];
      const samples = recording.samples.filter(Boolean);
      // A missing recording can use the original Archive fallback. While
      // samples are loading, don't insert a synthetic step into the sequence.
      if (!samples.length && recording.pending) return;
      const now = context.currentTime;
      if (now - (lastPlayed.get(surface) ?? -Infinity) < .045) return;
      lastPlayed.set(surface, now);
      if (!samples.length && !procedural.has(surface)) {
        procedural.set(surface, makeClip(context, surfaces[surface]));
      }
      const variation = nextVariation ? nextVariation() : step++;
      const source = context.createBufferSource();
      source.buffer = samples.length ? samples[variation % samples.length] : procedural.get(surface);
      source.playbackRate.value = playbackRates[variation % playbackRates.length];
      const volume = context.createGain();
      volume.gain.value = running ? .415 : .33;
      source.connect(volume).connect(output);
      source.onended = () => { source.disconnect(); volume.disconnect(); };
      source.start();
    } catch { /* sound is optional */ }
  }

  return { unlock, update, reset, setPlaying };
}
