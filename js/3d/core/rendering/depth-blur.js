// @ts-check
import * as THREE from 'three';

// The game's one background blur ("Размытие фона"), first made for the
// Atelier: whatever lies beyond the focus distance softens with a separable
// Gaussian at half resolution, read from the frame's depth. The blurred layer
// is premultiplied by "how much background" each pixel is, so the sharp
// foreground never bleeds into the wall behind it.
//
//   const blur = createDepthBlur({ renderer });
//   blur.render({ color, depth, camera, focus, radius, near, far });   // after the scene pass
//   // in the scene's composite shader, with DEPTH_BLUR_GLSL included:
//   color.rgb = keynlockDepthBlur(color.rgb, tBlur, vUv, amount * keynlockBackgroundMask(distance, focus, near, far));
//
// The Atelier's drawing filter and the Lair's outline pass use it.

/** For the scene's composite shader: the mask and the mix with the blurred layer. */
export const DEPTH_BLUR_GLSL = /* glsl */`
float keynlockBackgroundMask(float distance, float focus, float near, float far) {
  return smoothstep(near, far, distance - focus);
}
vec3 keynlockDepthBlur(vec3 color, sampler2D blurred, vec2 uv, float amount) {
  if (amount <= .001) return color;
  // Premultiplied by background coverage: the division removes foreground halos.
  vec4 soft = texture2D(blurred, uv);
  return soft.a > .001 ? mix(color, soft.rgb / soft.a, amount) : color;
}`;

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fragmentShader = /* glsl */`
  uniform sampler2D tSource;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform vec2 uDirection;
  uniform float uNear, uFar, uFocus, uBlurRadius, uBlurNear, uBlurFar, uPremultiplied;
  varying vec2 vUv;
  ${DEPTH_BLUR_GLSL}

  float eyeDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }
  vec4 backgroundSample(vec2 uv) {
    vec4 color = texture2D(tSource, uv);
    if (uPremultiplied > 0.5) return color;
    float mask = keynlockBackgroundMask(eyeDepth(uv), uFocus, uBlurNear, uBlurFar);
    return vec4(color.rgb * mask, mask);
  }
  void main() {
    // Half resolution: the radius is in full-resolution device pixels.
    vec2 direction = uDirection * uTexel * max(.25, uBlurRadius * .125);
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
  }`;

/**
 * Two half-resolution passes; `texture` holds the result for the composite.
 * @param {{ renderer: THREE.WebGLRenderer }} options
 */
export function createDepthBlur({ renderer }) {
  const makeTarget = () => new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false, stencilBuffer: false, type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const horizontal = makeTarget(), vertical = makeTarget();
  const uniforms = {
    tSource: { value: null }, tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) }, uDirection: { value: new THREE.Vector2(1, 0) },
    uNear: { value: .1 }, uFar: { value: 100 }, uFocus: { value: 0 },
    uBlurRadius: { value: 6 }, uBlurNear: { value: 1 }, uBlurFar: { value: 3 }, uPremultiplied: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const screen = new THREE.Scene();
  screen.add(quad);
  const screenCamera = new THREE.Camera();

  /** Full-resolution size of the frame being blurred, in device pixels. */
  function setSize(width, height) {
    const w = Math.max(1, Math.ceil(width / 2)), h = Math.max(1, Math.ceil(height / 2));
    if (horizontal.width === w && horizontal.height === h) return;
    horizontal.setSize(w, h);
    vertical.setSize(w, h);
    uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  /**
   * @param {{ color: THREE.Texture, depth: THREE.Texture, camera: THREE.PerspectiveCamera,
   *   focus: number, radius: number, near: number, far: number }} pass
   *   radius in CSS pixels; near/far: how far past the focus the blur begins and is full.
   */
  function render({ color, depth, camera, focus, radius, near, far }) {
    uniforms.tDepth.value = depth;
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    uniforms.uFocus.value = focus;
    uniforms.uBlurRadius.value = radius * renderer.getPixelRatio();
    uniforms.uBlurNear.value = near;
    uniforms.uBlurFar.value = far;
    const previous = renderer.getRenderTarget();
    uniforms.tSource.value = color;
    uniforms.uDirection.value.set(1, 0);
    uniforms.uPremultiplied.value = 0;
    renderer.setRenderTarget(horizontal);
    renderer.render(screen, screenCamera);
    uniforms.tSource.value = horizontal.texture;
    uniforms.uDirection.value.set(0, 1);
    uniforms.uPremultiplied.value = 1;
    renderer.setRenderTarget(vertical);
    renderer.render(screen, screenCamera);
    renderer.setRenderTarget(previous);
  }

  return {
    render, setSize,
    /** The blurred, premultiplied layer (DEPTH_BLUR_GLSL's `blurred`). */
    texture: vertical.texture,
    /** Draw calls one render() adds. */
    passes: 2,
    dispose() { horizontal.dispose(); vertical.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}
