// @ts-check
// Stable circular samples avoid repeated trigonometry in every fluid vertex.
const cached = new Map();

export function circleSamples(segments) {
  if (!Number.isInteger(segments) || segments < 3) throw new RangeError('Circular segments must be >= 3');
  if (!cached.has(segments)) {
    const cos = new Float64Array(segments + 1);
    const sin = new Float64Array(segments + 1);
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      cos[i] = Math.cos(angle);
      sin[i] = Math.sin(angle);
    }
    cached.set(segments, { cos, sin });
  }
  return cached.get(segments);
}
