const SAMPLE_RATE = 24000;

// Each layer is a decaying impact or a filtered burst of noise. Offsets give
// keys their loose metallic rattle and let water and the forge trail off.
export const ring = (frequency, length, level, at = 0, bend = 0) =>
  ({ frequency, length, level, at, bend });
export const noise = (low, high, length, level, at = 0, attack = .003) =>
  ({ low, high, length, level, at, attack });

export function makeClip(context, layers) {
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
