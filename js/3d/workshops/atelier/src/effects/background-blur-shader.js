// @ts-check
/** Separable Gaussian blur of the room, stored as premultiplied background color. */
export const backgroundBlurFragmentShader = `
  uniform sampler2D tSource;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform vec2 uDirection;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uBlurRadius;
  uniform float uBlurNear;
  uniform float uBlurFar;
  uniform float uPremultiplied;
  varying vec2 vUv;

  float eyeDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  float backgroundMask(float distance) {
    return smoothstep(uBlurNear, uBlurFar, distance - uFocus);
  }

  vec4 backgroundSample(vec2 uv) {
    vec4 color = texture2D(tSource, uv);
    if (uPremultiplied > 0.5) return color;
    // Foreground paintings never contribute colors to blurred wall pixels.
    float mask = backgroundMask(eyeDepth(uv));
    return vec4(color.rgb * mask, mask);
  }

  void main() {
    // Half-resolution pass: radius is measured in full-resolution device pixels.
    float stepSize = max(.25, uBlurRadius * .125);
    vec2 direction = uDirection * uTexel * stepSize;
    vec4 color = backgroundSample(vUv) * .2270270;
    color += backgroundSample(clamp(vUv + direction, vec2(0.0), vec2(1.0))) * .1945946;
    color += backgroundSample(clamp(vUv - direction, vec2(0.0), vec2(1.0))) * .1945946;
    color += backgroundSample(clamp(vUv + direction * 2.0, vec2(0.0), vec2(1.0))) * .1216216;
    color += backgroundSample(clamp(vUv - direction * 2.0, vec2(0.0), vec2(1.0))) * .1216216;
    color += backgroundSample(clamp(vUv + direction * 3.0, vec2(0.0), vec2(1.0))) * .0540540;
    color += backgroundSample(clamp(vUv - direction * 3.0, vec2(0.0), vec2(1.0))) * .0540540;
    color += backgroundSample(clamp(vUv + direction * 4.0, vec2(0.0), vec2(1.0))) * .0162160;
    color += backgroundSample(clamp(vUv - direction * 4.0, vec2(0.0), vec2(1.0))) * .0162160;
    gl_FragColor = color;
  }
`;
