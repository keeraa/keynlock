/** Shared KEYNLOCK GLSL blur kernels. Each scene owns its render targets and passes. */
export const BACKGROUND_BLUR_MODES = Object.freeze({ off: 'off', background: 'background', depth: 'depth' });

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

// Restoration focuses on the easels; depth-aware taps preserve foreground edges.
// The consuming shader supplies eyeDepth(vec2) and its depth uniforms.
export const DEPTH_BLUR_GLSL = `
vec4 keynlockDepthBlur(sampler2D colorTexture, vec2 uv, vec2 pixel, float focus, float amount) {
  vec4 center = texture2D(colorTexture, uv);
  if (amount > 0.0) {
    float centerDepth = eyeDepth(uv);
    float distanceBehind = centerDepth - focus;
    float background = smoothstep(1.6, 3.5, distanceBehind) * amount;
    if (background > 0.001) {
      vec2 shift = pixel * 2.4;
      vec4 soft = center * 4.0;
      float weight = 4.0;
      for (int i = 0; i < 4; i++) {
        vec2 offset = i == 0 ? vec2(shift.x, 0.0) :
          i == 1 ? vec2(-shift.x, 0.0) :
          i == 2 ? vec2(0.0, shift.y) : vec2(0.0, -shift.y);
        vec2 sampleUv = clamp(uv + offset, vec2(0.0), vec2(1.0));
        float tap = 1.0 - smoothstep(.12, .65, abs(eyeDepth(sampleUv) - centerDepth));
        soft += texture2D(colorTexture, sampleUv) * tap;
        weight += tap;
      }
      center = mix(center, soft / weight, background);
    }
  }
  return center;
}`;

export const BLUR_PRESETS = Object.freeze({
  alchemy: Object.freeze({ mode: BACKGROUND_BLUR_MODES.background, strength: 1 }),
  restoration: Object.freeze({ mode: BACKGROUND_BLUR_MODES.depth, strength: .56, focus: 7.15 }),
});
