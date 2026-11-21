/** Shared KEYNLOCK GLSL blur kernels. Each scene owns its render targets and passes. */

// The alchemy room is a separately cached render target. Keep its original nine taps.
export const ROOM_BLUR_GLSL = `
vec4 keynlockRoomBlur(sampler2D room, vec2 uv, vec2 pixel, float amount) {
  vec4 center = texture2D(room, uv);
  vec2 offset = pixel * (2.15 * amount);
  vec4 softened = center * .32;
  softened += texture2D(room, uv + vec2(offset.x, 0.0)) * .12;
  softened += texture2D(room, uv - vec2(offset.x, 0.0)) * .12;
  softened += texture2D(room, uv + vec2(0.0, offset.y)) * .12;
  softened += texture2D(room, uv - vec2(0.0, offset.y)) * .12;
  softened += texture2D(room, uv + offset) * .05;
  softened += texture2D(room, uv - offset) * .05;
  softened += texture2D(room, uv + vec2(offset.x, -offset.y)) * .05;
  softened += texture2D(room, uv + vec2(-offset.x, offset.y)) * .05;
  return mix(center, softened, .86 * amount);
}`;
