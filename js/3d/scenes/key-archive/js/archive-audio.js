// Small, optional audio layer. Gameplay remains playable when AudioContext is unavailable.
export function createArchiveAudio(browserWindow) {
  let muted = false;
  let context;
  function tone(kind = 'take') {
    if (muted) return;
    try {
      context ||= new (browserWindow.AudioContext || browserWindow.webkitAudioContext)();
      if (context.state === 'suspended') context.resume();
      const now = context.currentTime;
      const notes = kind === 'water' ? [[310, .11], [235, .15], [365, .08]] :
        kind === 'rust' ? [[880, .07], [720, .10], [560, .13]] :
        kind === 'melt' ? [[260, .12], [160, .20], [95, .30]] :
        kind === 'trash' ? [[330, .07], [220, .16]] :
        kind === 'place' ? [[440, .09], [660, .12]] :
        kind === 'finish' ? [[440, .11], [554, .14], [659, .20]] :
        kind === 'wrong' ? [[220, .11]] : [[680, .06], [910, .05]];
      let offset = 0;
      for (const [frequency, duration] of notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = kind === 'wrong' || kind === 'rust' ? 'triangle' :
          kind === 'melt' ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + offset);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .75, now + offset + duration);
        gain.gain.setValueAtTime(.0001, now + offset);
        const peak = kind === 'wrong' ? .028 : kind === 'melt' ? .021 :
          kind === 'rust' ? .026 : .056;
        gain.gain.exponentialRampToValueAtTime(peak, now + offset + .009);
        gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + duration + .02);
        offset += kind === 'finish' ? .10 : kind === 'water' || kind === 'rust' ? .10 : .045;
      }
    } catch { /* sound is optional */ }
  }
  return {
    tone,
    setMuted(value) { muted = Boolean(value); },
    isMuted() { return muted; },
    toggleMuted() { muted = !muted; return muted; },
  };
}
