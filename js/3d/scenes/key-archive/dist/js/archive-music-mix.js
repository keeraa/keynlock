const MENU_CUTOFF_HZ = 280;
const PLAY_CUTOFF_HZ = 19500;
const CEILING_SPEAKERS = [[-4.8, 11.4, -9], [4.8, 11.4, 9]];

function roomImpulse(context) {
  const length = Math.round(context.sampleRate * .76);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  let noise = 19;
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      const seconds = i / context.sampleRate;
      const attack = Math.min(1, Math.max(0, (seconds - .018) / .045));
      data[i] = (noise / 2147483648 - 1) * attack * Math.exp(-seconds * 8) * .13;
    }
    for (const [seconds, level] of [[.033, .50], [.061, .38], [.096, .25]])
      data[Math.round((seconds + channel * .005) * context.sampleRate)] += level;
  }
  return impulse;
}

export function createArchiveMusicMix(context, audio, { volume, paused, spatial }) {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = .4;
  filter.frequency.value = paused ? MENU_CUTOFF_HZ : PLAY_CUTOFF_HZ;
  filter.channelCount = 2;
  filter.channelCountMode = 'explicit';
  const dry = context.createGain();
  const speakers = context.createGain();
  const reflections = context.createGain();
  const master = context.createGain();
  dry.gain.value = spatial ? .08 : 1;
  speakers.gain.value = spatial ? .93 : 0;
  reflections.gain.value = spatial ? .16 : 0;
  master.gain.value = volume;
  dry.connect(master);
  speakers.connect(master);
  reflections.connect(master);
  master.connect(context.destination);
  filter.connect(dry);

  const splitter = context.createChannelSplitter(2);
  filter.connect(splitter);
  const room = context.createConvolver();
  room.buffer = roomImpulse(context);
  room.connect(reflections);
  filter.connect(room);
  for (const [index, [x, y, z]] of CEILING_SPEAKERS.entries()) {
    const speaker = context.createPanner();
    speaker.panningModel = 'HRTF';
    speaker.distanceModel = 'inverse';
    speaker.refDistance = 10;
    speaker.rolloffFactor = .42;
    if (speaker.positionX) {
      speaker.positionX.value = x;
      speaker.positionY.value = y;
      speaker.positionZ.value = z;
    } else speaker.setPosition(x, y, z);
    splitter.connect(speaker, index);
    speaker.connect(speakers);
  }
  // Attach the media element only after the graph is ready, so initialization
  // failures can still use direct browser playback.
  context.createMediaElementSource(audio).connect(filter);
  audio.volume = 1;

  function ramp(param, value, seconds) {
    param.setTargetAtTime(value, context.currentTime, seconds);
  }
  return {
    resume() { context.resume()?.catch(() => {}); },
    setVolume(value) { ramp(master.gain, value, .035); },
    setPaused(paused) { ramp(filter.frequency, paused ? MENU_CUTOFF_HZ : PLAY_CUTOFF_HZ, .08); },
    setSpatial(enabled) {
      ramp(dry.gain, enabled ? .08 : 1, .12);
      ramp(speakers.gain, enabled ? .93 : 0, .12);
      ramp(reflections.gain, enabled ? .16 : 0, .12);
    },
    setListener(position, forward, up) {
      const listener = context.listener;
      if (!listener.positionX) {
        listener.setPosition(position.x, position.y, position.z);
        listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        return;
      }
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    },
  };
}
