// @ts-check
import * as THREE from 'three';

// The Lair's ink outline, ported from the Key Archive's full-screen contour
// (key-archive/dist/js/scene-outline.js, itself from Key Forge). One pass over
// the frame's depth draws silhouettes and folds of every visible opaque
// object (room, Atelier, lab, frames, easels) with no hulls, no per-object
// draw calls and nothing to fall behind when furniture moves or resizes.
//
// Like the Archive, normals come from a second pass that draws the opaque
// scene with MeshNormalMaterial: true per-face normals make straight folds
// (frame sides, easel legs) straight lines. It roughly doubles the draw
// calls of a frame; normals rebuilt from depth were cheaper but jagged.

const INK = Object.freeze({ color: '#2b241d', radius: 1.35, opacity: .82, normalThreshold: .42, depthThreshold: .018 });

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fragmentShader = /* glsl */`
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform vec2 uResolution;
  uniform mat4 uProjectionInverse;
  uniform vec3 uViewUp;
  uniform float uNear, uFar, uWidth, uInk, uNormalThreshold, uDepthThreshold, uFadeNear, uFadeFar, uUseNormals;
  uniform vec3 uInkColor;
  varying vec2 vUv;

  float rawDepth(vec2 uv) { return texture2D(tDepth, uv).r; }
  float occupied(float depth) { return 1.0 - step(0.99995, depth); }
  float viewDistance(float depth) { return (uNear * uFar) / max(.0001, uFar - depth * (uFar - uNear)); }
  // View-space normal from the normal pass (MeshNormalMaterial packs it 0..1).
  // Without the normal pass (low quality) every face reads as facing the
  // camera: folds then come only from depth steps.
  vec3 normalAt(vec2 uv) {
    return uUseNormals > .5 ? normalize(texture2D(tNormal, uv).rgb * 2.0 - 1.0) : vec3(0.0, 0.0, 1.0);
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
      neighborNormal = normalAt(uv);
      crease = max(
        smoothstep(uNormalThreshold, uNormalThreshold + .15, length(normal - neighborNormal)),
        smoothstep(uDepthThreshold, uDepthThreshold * 1.8, jump));
      // Floor boards, table tops and papers: two upward faces with only a small
      // step between them (plank seams, ruled lines) get no ink. A real drop,
      // like a table top over the floor, keeps it.
      float upward = uUseNormals * smoothstep(.82, .94, dot(normal, uViewUp)) * smoothstep(.82, .94, dot(neighborNormal, uViewUp));
      crease *= 1.0 - upward * (1.0 - smoothstep(.06, .14, jump));
    }
    // Ink goes on the farther surface, outside the nearer silhouette. Along a
    // fold (no real depth step) it goes on the face turned further from the
    // camera (smaller view-space normal z): one side, the same along the edge.
    float relative = (distance - neighborDistance) / max(.05, distance);
    float farther = smoothstep(-uDepthThreshold * .12, uDepthThreshold * .12, relative);
    float decisive = smoothstep(uDepthThreshold * .6, uDepthThreshold * 1.6, jump);
    float oblique = smoothstep(-.02, .02, neighborNormal.z - normal.z);
    float outside = mix(farther, mix(oblique, farther, decisive), here * there);
    return max(silhouette, crease) * outside;
  }

  float inkEdge() {
    float depth = rawDepth(vUv);
    float here = occupied(depth);
    closestInkDepth = depth;
    float distance = viewDistance(depth);
    vec3 normal = here > .5 ? normalAt(vUv) : vec3(0.0, 0.0, 1.0);
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
    // Glass in front (the normal buffer's alpha is 0 there): the lines behind
    // it stay faint instead of showing through the tubes and flasks.
    float glass = uUseNormals > .5 ? 1.0 - texture2D(tNormal, vUv).a : 0.0;
    ink *= 1.0 - .85 * glass;
    gl_FragColor = vec4(mix(color.rgb, uInkColor, clamp(ink, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Renders the scene through the outline: render() replaces renderer.render(scene, camera). */
export function createSceneOutline({ renderer, scene, camera }) {
  let enabled = true, widthScale = 1, samples = 4, normals = true;
  let target = null, normalTarget = null;
  const size = new THREE.Vector2();
  const normalMaterial = new THREE.MeshNormalMaterial();
  const clearColor = new THREE.Color();
  // See-through things (glass, glows, flames, dust) stay out of the normal
  // pass: the depth buffer does not hold them either. Found again each second.
  let hidden = [], hiddenFoundAt = -Infinity;
  // Glass marks the normal buffer's alpha (see the shader): layer 9 holds it.
  const GLASS_LAYER = 9;
  // Only plain glass on the default layer: special passes (the lab's lens on
  // layer 1) expect their own material in onBeforeRender.
  const plainRender = THREE.Object3D.prototype.onBeforeRender;
  const isGlass = object => object.isMesh && !object.userData.atmosphere && object.layers.isEnabled(0) &&
    object.onBeforeRender === plainRender && [object.material].flat().some(material =>
    material?.transparent && material.blending === THREE.NormalBlending && material.opacity >= .12 && material.colorWrite !== false);
  const glassMask = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.ZeroFactor,
  });
  const seeThrough = object => object.visible && (object.isPoints || object.isLine || object.isSprite ||
    (object.isMesh && ([object.material].flat().some(material => material?.transparent || material?.depthWrite === false) ||
      object.userData.atmosphere)));
  const uniforms = {
    tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uProjectionInverse: { value: new THREE.Matrix4() },
    uViewUp: { value: new THREE.Vector3(0, 1, 0) },
    uNear: { value: camera.near }, uFar: { value: camera.far },
    uWidth: { value: /** @type {number} */ (INK.radius) }, uInk: { value: /** @type {number} */ (INK.opacity) },
    uInkColor: { value: new THREE.Color(INK.color) },
    uNormalThreshold: { value: INK.normalThreshold }, uDepthThreshold: { value: INK.depthThreshold },
    // The room is large: ink fades a little with distance, not to nothing.
    uFadeNear: { value: 9 }, uFadeFar: { value: 40 },
    uUseNormals: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const screen = new THREE.Scene();
  screen.add(quad);
  const screenCamera = new THREE.Camera();

  function ensureTarget() {
    renderer.getDrawingBufferSize(size);
    if (target && target.width === size.x && target.height === size.y && target.samples === samples) return target;
    target?.depthTexture?.dispose();
    target?.dispose();
    normalTarget?.dispose();
    normalTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    uniforms.tNormal.value = normalTarget.texture;
    // 32-bit float depth for steady distance steps.
    const depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.FloatType);
    target = new THREE.WebGLRenderTarget(size.x, size.y, {
      samples, type: THREE.HalfFloatType, depthTexture,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    uniforms.tColor.value = target.texture;
    uniforms.tDepth.value = depthTexture;
    uniforms.uResolution.value.set(size.x, size.y);
    return target;
  }

  function renderNormals() {
    const now = performance.now();
    if (now - hiddenFoundAt > 1000) {
      hidden = [];
      scene.traverseVisible(object => {
        if (!seeThrough(object)) return;
        hidden.push(object);
        if (isGlass(object)) object.layers.enable(GLASS_LAYER);
      });
      hiddenFoundAt = now;
    }
    const shown = hidden.filter(object => object.visible);
    for (const object of shown) object.visible = false;
    const { background, overrideMaterial } = scene;
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(clearColor);
    const clearAlpha = renderer.getClearAlpha();
    scene.background = null;
    scene.overrideMaterial = normalMaterial;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;              // the colour pass has drawn the shadows
    renderer.setRenderTarget(normalTarget);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    for (const object of shown) object.visible = true;
    // Glass over the opaque depth just drawn clears the alpha where it is in front.
    const layers = camera.layers.mask, autoClear = renderer.autoClear;
    camera.layers.set(GLASS_LAYER);
    scene.overrideMaterial = glassMask;
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = autoClear;
    camera.layers.mask = layers;
    scene.background = background;
    scene.overrideMaterial = overrideMaterial;
    renderer.shadowMap.autoUpdate = shadows;
    renderer.setClearColor(clearColor, clearAlpha);
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
    if (normals) renderNormals();
    renderer.setRenderTarget(previous);
    renderer.render(screen, screenCamera);
  }

  return {
    render,
    setEnabled(value) { enabled = Boolean(value); },
    /** The visual panel's 20–140 % stroke width. */
    setWidth(percent) { widthScale = THREE.MathUtils.clamp((Number(percent) || 0) / 65, .3, 2.2); },
    isEnabled: () => enabled,
    /** Quality level (rendering/quality.js): MSAA samples and the normal pass. */
    setQuality(options) {
      samples = options.samples;
      normals = Boolean(options.normals);
      uniforms.uUseNormals.value = normals ? 1 : 0;
    },
    dispose() {
      target?.depthTexture?.dispose(); target?.dispose(); normalTarget?.dispose();
      material.dispose(); normalMaterial.dispose(); glassMask.dispose(); quad.geometry.dispose();
    },
  };
}
