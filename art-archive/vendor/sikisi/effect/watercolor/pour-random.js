// Randomness is sampled once per pour, never once per frame.
let lastAutomaticSeed;
export function resolvePourSeed(seed) {
  if (seed !== undefined) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      throw new RangeError('seed must be a uint32');
    return seed;
  }
  const value = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(value);
  else value[0] = Math.floor(Math.random() * 0x100000000);
  if (value[0] === lastAutomaticSeed) value[0] = (value[0] + 0x9e3779b9) >>> 0;
  lastAutomaticSeed = value[0];
  return value[0];
}
export function createPourRandom(seed) {
  let state = resolvePourSeed(seed);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
