/** Validate the host before allocating GPU resources. No imported Three singleton. */
export function validateRuntime(
  { THREE, renderer, width, height, resolution },
  { attachments = 1 } = {},
) {
  if (!THREE || !renderer?.isWebGLRenderer)
    throw new TypeError('Pass host THREE and WebGLRenderer');
  validateSize(width, height);
  if (!Number.isInteger(resolution) || resolution < 64 || resolution > 1024)
    throw new RangeError('Resolution must be an integer from 64 to 1024');
  const gl = renderer.getContext();
  if (typeof gl.drawBuffers !== 'function' || !gl.getExtension('EXT_color_buffer_float'))
    throw new Error('Watercolor requires WebGL2 and EXT_color_buffer_float');
  if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < attachments)
    throw new Error(`Watercolor requires ${attachments} colour attachments`);
}
export function validateSize(width, height) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0))
    throw new RangeError('Viewport dimensions must be positive');
}
export function copyPalette(palette) {
  if (
    !Array.isArray(palette) ||
    palette.length !== 7 ||
    palette.some((c) => !/^#[\da-f]{6}$/i.test(c))
  )
    throw new TypeError('Palette requires seven #RRGGBB colours');
  return Object.freeze([...palette]);
}
export function validateSource({ x, y, width, height, seed, impact = 0 }) {
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1 ||
    width <= 0 ||
    height <= 0
  )
    throw new RangeError('Source expects normalized x/y and positive width/height');
  if (!Number.isFinite(impact) || impact < 0 || impact > 1)
    throw new RangeError('Impact must be from 0 to 1');
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff))
    throw new RangeError('seed must be a uint32');
}
export const IMPACT_RELEASE_SPEED = 1.4;
export function releaseTimeScale(impact, age, duration) {
  return age < duration ? 1 + (IMPACT_RELEASE_SPEED - 1) * impact : 1;
}
