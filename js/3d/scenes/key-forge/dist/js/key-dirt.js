// Deterministic hash noise shared by the wax and mud coats.
// (The old flat mud rim that lived here was replaced by key-mud.js.)
export function stableNoise(value) {
  const v=Math.sin(value*12.9898+78.233)*43758.5453;
  return v-Math.floor(v);
}
