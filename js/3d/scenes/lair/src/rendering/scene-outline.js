// @ts-check
import * as THREE from 'three';

// The Lair's ink outline, ported from the Key Archive's full-screen contour
// (key-archive/dist/js/scene-outline.js, itself from Key Forge). One pass over
// the frame's depth draws silhouettes and folds of every visible opaque
// object (room, Atelier, lab, frames, easels) with no hulls, no per-object
// draw calls and nothing to fall behind when furniture moves or resizes.
//
// The Archive reads normals from a second scene pass. Here they are rebuilt
// from depth, so the whole frame is still drawn once (plus one screen quad).

const INK = Object.freeze({ color: '#2b241d', radius: 1.35, opacity: .82, normalThreshold: .42, depthThreshold: .018 });

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fragmentShader = /* glsl */`
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;
  uniform mat4 uProjectionInverse;
  uniform vec3 uViewUp;
  uniform float uNear, uFar, uWidth, uInk, uNormalThreshold, uDepthThreshold, uFadeNear, uFadeFar;
  uniform vec3 uInkColor;
  varying vec2 vUv;

  float rawDepth(vec2 uv) { return texture2D(tDepth, uv).r; }
  float occupied(float depth) { return 1.0 - step(0.99995, depth); }
  float viewDistance(float depth) { return (uNear * uFar) / max(.0001, uFar - depth * (uFar - uNear)); }
  vec3 viewPosition(vec2 uv, float depth) {
    vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 view = uProjectionInverse * clip;
    return view.xyz / view.w;
  }
  // A face's normal from its depth and its neighbours'. On each axis the side
  // with the smaller depth change is used, so an edge next to the pixel does
  // not bend its normal (that noise drew dashes along plank seams).
  vec3 normalAt(vec2 uv, float depth) {
    vec2 pixel = 1.0 / uResolution;
    vec3 here = viewPosition(uv, depth);
    float right = rawDepth(uv + vec2(pixel.x, 0.0)), left = rawDepth(uv - vec2(pixel.x, 0.0));
    float above = rawDepth(uv + vec2(0.0, pixel.y)), below = rawDepth(uv - vec2(0.0, pixel.y));
    vec3 across = abs(right - depth) < abs(depth - left)
      ? viewPosition(uv + vec2(pixel.x, 0.0), right) - here
      : here - viewPosition(uv - vec2(pixel.x, 0.0), left);
    vec3 up = abs(above - depth) < abs(depth - below)
      ? viewPosition(uv + vec2(0.0, pixel.y), above) - here
      : here - viewPosition(uv - vec2(0.0, pixel.y), below);
    return normalize(cross(across, up));
  }

  float closestInkDepth;
  float edgeAt(vec2 direction, float depth, float distance, vec3 normal, float here) {
    vec2 uv = clamp(vUv + direction * uWidth / uResolution, vec2(.001), vec2(.999));
    float neighborDepth = rawDepth(uv);
    closestInkDepth = min(closestInkDepth, neighborDepth);
    float there = occupied(neighborDepth);
    float silhouette = abs(here - there);
    float neighborDistance = viewDistance(neighborDepth);
    // A step in distance, relative to how far away it is.
    float jump = abs(distance - neighborDistance) / max(.05, min(distance, neighborDistance));
    float crease = 0.0;
    vec3 neighborNormal = normal;
    if (here > .5 && there > .5) {
      neighborNormal = normalAt(uv, neighborDepth);
      crease = max(
        smoothstep(uNormalThreshold, uNormalThreshold + .15, length(normal - neighborNormal)),
        smoothstep(uDepthThreshold, uDepthThreshold * 1.8, jump));
      // Floor boards, table tops and papers: two upward faces with only a small
      // step between them (plank seams, ruled lines) get no ink. A real drop,
      // like a table top over the floor, keeps it.
      float upward = smoothstep(.82, .94, dot(normal, uViewUp)) * smoothstep(.82, .94, dot(neighborNormal, uViewUp));
      crease *= 1.0 - upward * (1.0 - smoothstep(.06, .14, jump));
    }
    // Ink goes on the farther surface, outside the nearer silhouette. Along a
    // fold (no real depth step) the side cannot be told reliably from normals
    // rebuilt from depth: choosing one flipped from pixel to pixel and drew a
    // saw edge. There the line is centred on the fold, on both faces, at
    // half strength each, so it stays one straight line.
    float relative = (distance - neighborDistance) / max(.05, distance);
    float farther = smoothstep(-uDepthThreshold * .12, uDepthThreshold * .12, relative);
    float decisive = smoothstep(uDepthThreshold * .6, uDepthThreshold * 1.6, jump);
    float outside = mix(farther, mix(.62, farther, decisive), here * there);
    return max(silhouette, crease) * outside;
  }

  float inkEdge() {
    float depth = rawDepth(vUv);
    float here = occupied(depth);
    closestInkDepth = depth;
    float distance = viewDistance(depth);
    vec3 normal = here > .5 ? normalAt(vUv, depth) : vec3(0.0, 0.0, 1.0);
    vec4 cardinal = vec4(
      edgeAt(vec2( 1.0,  0.0), depth, distance, normal, here), edgeAt(vec2(-1.0,  0.0), depth, distance, normal, here),
      edgeAt(vec2( 0.0,  1.0), depth, distance, normal, here), edgeAt(vec2( 0.0, -1.0), depth, distance, normal, here));
    vec4 diagonal = vec4(
      edgeAt(vec2( .7,  .7), depth, distance, normal, here), edgeAt(vec2(-.7,  .7), depth, distance, normal, here),
      edgeAt(vec2( .7, -.7), depth, distance, normal, here), edgeAt(vec2(-.7, -.7), depth, distance, normal, here));
    vec4 peaks = max(cardinal, diagonal);
    float peak = max(max(peaks.x, peaks.y), max(peaks.z, peaks.w));
    // Agreement across directions makes the solid stroke; one tap a soft fringe.
    float support = dot(cardinal, vec4(1.0)) + dot(diagonal, vec4(.8));
    float outline = mix(peak, smoothstep(0.0, 2.6, support), .72);
    return outline * mix(1.0, .45, smoothstep(uFadeNear, uFadeFar, viewDistance(closestInkDepth)));
  }

  void main() {
    vec4 color = texture2D(tColor, vUv);
    float ink = uInk > 0.0 ? inkEdge() * uInk : 0.0;
    gl_FragColor = vec4(mix(color.rgb, uInkColor, clamp(ink, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Renders the scene through the outline: render() replaces renderer.render(scene, camera). */
export function createSceneOutline({ renderer, scene, camera }) {
  let enabled = true, widthScale = 1;
  let target = null;
  const size = new THREE.Vector2();
  const uniforms = {
    tColor: { value: null }, tDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uProjectionInverse: { value: new THREE.Matrix4() },
    uViewUp: { value: new THREE.Vector3(0, 1, 0) },
    uNear: { value: camera.near }, uFar: { value: camera.far },
    uWidth: { value: /** @type {number} */ (INK.radius) }, uInk: { value: /** @type {number} */ (INK.opacity) },
    uInkColor: { value: new THREE.Color(INK.color) },
    uNormalThreshold: { value: INK.normalThreshold }, uDepthThreshold: { value: INK.depthThreshold },
    // The room is large: ink fades a little with distance, not to nothing.
    uFadeNear: { value: 9 }, uFadeFar: { value: 40 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const screen = new THREE.Scene();
  screen.add(quad);
  const screenCamera = new THREE.Camera();

  function ensureTarget() {
    renderer.getDrawingBufferSize(size);
    if (target && target.width === size.x && target.height === size.y) return target;
    target?.depthTexture?.dispose();
    target?.dispose();
    // 32-bit float depth: smoother rebuilt normals than 24-bit integer depth.
    const depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.FloatType);
    target = new THREE.WebGLRenderTarget(size.x, size.y, {
      samples: 4, type: THREE.HalfFloatType, depthTexture,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    uniforms.tColor.value = target.texture;
    uniforms.tDepth.value = depthTexture;
    uniforms.uResolution.value.set(size.x, size.y);
    return target;
  }

  function render() {
    if (!enabled) { renderer.render(scene, camera); return; }
    const frame = ensureTarget();
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    camera.updateMatrixWorld();
    uniforms.uViewUp.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    uniforms.uWidth.value = INK.radius * widthScale * Math.max(1, renderer.getPixelRatio());
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(frame);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    renderer.render(screen, screenCamera);
  }

  return {
    render,
    setEnabled(value) { enabled = Boolean(value); },
    /** The visual panel's 20–140 % stroke width. */
    setWidth(percent) { widthScale = THREE.MathUtils.clamp((Number(percent) || 0) / 65, .3, 2.2); },
    isEnabled: () => enabled,
    dispose() { target?.depthTexture?.dispose(); target?.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}
