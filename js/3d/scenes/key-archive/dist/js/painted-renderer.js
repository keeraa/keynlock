import * as THREE from '../vendor/three.js';
import { visualPassNeeded } from './visual-settings.js';

// KEYNLOCK painted/locks pipeline adapted from the original lock laboratory's
// drawing-shader and cartoon-filter. Preserve its depth/normal/material ink,
// feathered light bands and cool-shadow/warm-highlight palette.
export function createPaintedRenderer(renderer, scene, camera, initialSettings) {
  const uniforms = {
    tScene: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNearFar: { value: new THREE.Vector2(camera.near, camera.far) },
    uToonLight: { value: .8 },
    uSteps: { value: 4 },
    uMaterial: { value: .9 },
    uInk: { value: .7 },
    uWidth: { value: 1 },
    uBrush: { value: .95 },
    uDetail: { value: .02 },
  };
  const shader = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tScene;
      uniform sampler2D tDepth;
      uniform sampler2D tNormal;
      uniform vec2 uResolution;
      uniform vec2 uNearFar;
      uniform float uToonLight;
      uniform float uSteps;
      uniform float uMaterial;
      uniform float uInk;
      uniform float uWidth;
      uniform float uBrush;
      uniform float uDetail;
      varying vec2 vUv;
      float luminance(vec3 c) { return dot(c, vec3(.2126,.7152,.0722)); }
      float linearDepth(float depth) {
        return (uNearFar.x * uNearFar.y) / max(.0001, uNearFar.y - depth * (uNearFar.y - uNearFar.x));
      }
      float pigment(vec2 p) {
        return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
      }
      float paintedBand(float light, float bands) {
        float steps = max(1.0, bands - 1.0);
        float position = clamp(light, 0.0, 1.0) * steps;
        return (floor(position) + smoothstep(.36, .64, fract(position))) / steps;
      }
      float inkEdge(vec2 uv) {
        float centerZ = texture2D(tDepth, uv).r;
        float centerDistance = linearDepth(centerZ);
        vec4 centerN = texture2D(tNormal, uv);
        vec4 centerColor = texture2D(tScene, uv);
        float edge = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 axis = i == 0 ? vec2(1.0,0.0) : i == 1 ? vec2(-1.0,0.0) :
            i == 2 ? vec2(0.0,1.0) : vec2(0.0,-1.0);
          vec2 otherUv = clamp(uv + axis * uWidth / uResolution, vec2(0.0), vec2(1.0));
          float nextZ = texture2D(tDepth, otherUv).r;
          float otherDistance = linearDepth(nextZ);
          vec4 nextN = texture2D(tNormal, otherUv);
          vec4 nextColor = texture2D(tScene, otherUv);
          float depthDelta = otherDistance - centerDistance;
          float distanceChange = abs(depthDelta);
          float threshold = max(.035, min(centerDistance, otherDistance) * .012);
          float nearSide = mix(.48, 1.0, step(0.0, depthDelta));
          float depthEdge = smoothstep(threshold, threshold * 3.2, distanceChange) *
            nearSide * (1.0 - step(.9999, min(centerZ, nextZ)));
          float normalEdge = smoothstep(.23, .67, length(centerN.rgb - nextN.rgb)) *
            min(centerN.a, nextN.a) * step(centerZ, .9999) * step(nextZ, .9999) *
            (1.0 - smoothstep(threshold * 3.0, threshold * 7.0, distanceChange));
          float colorEdge = smoothstep(.22, .46, abs(luminance(centerColor.rgb) -
            luminance(nextColor.rgb))) * min(centerColor.a, nextColor.a) * .34;
          edge = max(edge, max(depthEdge, max(normalEdge, colorEdge)));
        }
        return edge;
      }
      void main() {
        vec3 color = texture2D(tScene, vUv).rgb;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        color = gl_FragColor.rgb;
        float light = luminance(color);
        if (uToonLight > 0.0) {
          float flatLight = paintedBand(light, uSteps);
          float paintedLight = mix(light, flatLight, uToonLight * uMaterial * .86);
          color *= clamp(paintedLight / max(light, .075), .60, 1.32);
          float highlight = smoothstep(.22, .83, light);
          vec3 coolShadow = vec3(.958, .976, 1.018);
          vec3 warmLight = vec3(1.018, 1.009, .984);
          color *= mix(vec3(1.0), mix(coolShadow, warmLight, highlight), uToonLight);
          color = mix(vec3(luminance(color)), color, 1.0 + uToonLight * .07);
        }
        if (uBrush > 0.0) {
          // Soft pigment variation, not a paper texture or noisy pixel grid.
          float scale = mix(19.0, 72.0, uDetail);
          vec2 p = vUv * uResolution / scale;
          vec2 i = floor(p);
          vec2 f = smoothstep(0.0, 1.0, fract(p));
          float n = mix(mix(pigment(i), pigment(i + vec2(1.0,0.0)), f.x),
                        mix(pigment(i + vec2(0.0,1.0)), pigment(i + vec2(1.0,1.0)), f.x), f.y);
          color *= 1.0 + (n - .5) * .046 * uBrush;
        }
        if (uInk > 0.0) {
          float edge = inkEdge(vUv) * uInk;
          color = mix(color, vec3(.018, .030, .035), edge * .96);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const postScene = new THREE.Scene();
  // Match the proven fullscreen camera from the KEYNLOCK lock laboratory.
  // A world-space ortho camera at z=0 may clip a fullscreen quad at its near plane.
  const postCamera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shader);
  quad.frustumCulled = false;
  postScene.add(quad);
  let settings = initialSettings;
  let target = null;
  let normalTarget = null;
  let normalMaterial = null;
  let currentWidth = 0;
  let currentHeight = 0;
  const bufferSize = new THREE.Vector2();
  let postFailed = false;
  let postValidated = false;
  const debug = renderer.debug;
  const previouslyReportedShaderError = debug?.onShaderError;
  if (debug) debug.onShaderError = (...args) => {
    postFailed = true;
    if (typeof previouslyReportedShaderError === 'function') previouslyReportedShaderError(...args);
    else console.error('KEYNLOCK: ошибка шейдера рисовки; включён обычный рендер.');
  };

  function resize() {
    renderer.getDrawingBufferSize(bufferSize);
    const w = Math.max(1, Math.floor(bufferSize.x));
    const h = Math.max(1, Math.floor(bufferSize.y));
    if (target && w === currentWidth && h === currentHeight) return;
    target?.depthTexture?.dispose();
    target?.dispose();
    normalTarget?.dispose();
    currentWidth = w;
    currentHeight = h;
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    depth.format = THREE.DepthFormat;
    target = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    target.depthTexture = depth;
    uniforms.tScene.value = target.texture;
    uniforms.tDepth.value = depth;
    uniforms.uResolution.value.set(w, h);
    if (normalTarget) {
      normalTarget = new THREE.WebGLRenderTarget(w, h, {
        depthBuffer: true,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
      uniforms.tNormal.value = normalTarget.texture;
    } else uniforms.tNormal.value = target.texture;
  }

  function renderNormals() {
    if (!normalTarget) {
      normalTarget = new THREE.WebGLRenderTarget(currentWidth, currentHeight, {
        depthBuffer: true,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
      normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      uniforms.tNormal.value = normalTarget.texture;
    }
    const hidden = [];
    const previousMaterial = scene.overrideMaterial;
    scene.traverse(object => {
      if (object.isPoints && object.visible) {
        hidden.push(object);
        object.visible = false;
        return;
      }
      if (!object.isMesh || !object.visible) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material?.transparent)) {
        hidden.push(object);
        object.visible = false;
      }
    });
    try {
      scene.overrideMaterial = normalMaterial;
      renderer.setRenderTarget(normalTarget);
      renderer.render(scene, camera);
    } finally {
      scene.overrideMaterial = previousMaterial;
      for (const object of hidden) object.visible = true;
    }
  }

  function setSettings(next) {
    settings = next;
    uniforms.uToonLight.value = next.toonEnabled ? next.toonLight / 100 : 0;
    uniforms.uSteps.value = next.toonSteps;
    uniforms.uMaterial.value = next.cartoonMaterial / 100;
    uniforms.uInk.value = next.outlineEnabled ? next.outlineStrength / 100 : 0;
    uniforms.uWidth.value = next.outlineWidth;
    uniforms.uBrush.value = next.brushExpression / 100;
    uniforms.uDetail.value = next.strokeDetail / 100;
    if (!next.outlineEnabled || next.outlineStrength <= 0) {
      normalTarget?.dispose();
      normalMaterial?.dispose();
      normalTarget = null;
      normalMaterial = null;
      uniforms.tNormal.value = target?.texture || null;
    }
  }

  function render() {
    if (postFailed || !visualPassNeeded(settings)) {
      renderer.render(scene, camera);
      return;
    }
    const oldTarget = renderer.getRenderTarget();
    try {
      resize();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      if (settings.outlineEnabled && settings.outlineStrength > 0) renderNormals();
      renderer.setRenderTarget(oldTarget);
      renderer.render(postScene, postCamera);
      if (postFailed || (!postValidated && isBlankResult())) {
        postFailed = true;
        renderer.setRenderTarget(oldTarget);
        renderer.render(scene, camera);
      }
      postValidated = true;
    } catch (error) {
      postFailed = true;
      renderer.setRenderTarget(oldTarget);
      console.error('KEYNLOCK: фильтр рисовки отключён после сбоя.', error);
      renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(oldTarget);
    }
  }

  function isBlankResult() {
    // Some drivers fail the post pass without throwing or emitting shader errors.
    // The opening hall has many distinct colours; a constant framebuffer is faulty.
    const gl = renderer.getContext();
    const sample = new Uint8Array(4);
    const pixels = [];
    for (const [x, y] of [[.18,.22],[.52,.47],[.83,.72]]) {
      gl.readPixels(Math.floor(currentWidth * x), Math.floor(currentHeight * y), 1, 1,
        gl.RGBA, gl.UNSIGNED_BYTE, sample);
      pixels.push([sample[0], sample[1], sample[2]]);
    }
    const [first] = pixels;
    return pixels.every(pixel => pixel.every((value, channel) => Math.abs(value - first[channel]) < 4));
  }

  function dispose() {
    if (debug) debug.onShaderError = previouslyReportedShaderError;
    target?.depthTexture?.dispose();
    target?.dispose();
    normalTarget?.dispose();
    normalMaterial?.dispose();
    quad.geometry.dispose();
    shader.dispose();
  }

  setSettings(initialSettings);
  return { render, resize, setSettings, dispose };
}
