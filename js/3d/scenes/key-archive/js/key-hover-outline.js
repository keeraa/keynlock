import * as THREE from '../vendor/three.js';
import { DUST_OCCLUSION_GLSL } from './scene-outline.js?v=readable-ink';

// The hovered key is drawn into a flat silhouette mask. A screen-space edge
// around that mask is continuous even at sharp corners and inside key holes.
export function createKeyHoverOutline(renderer, camera, mesh, { depthAware = false } = {}) {
  const maskScene = new THREE.Scene();
  maskScene.background = new THREE.Color(0x000000);
  const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide,
    depthTest: depthAware, depthWrite: depthAware, toneMapped: false });
  mesh.material = maskMaterial;
  mesh.visible = false;
  maskScene.add(mesh);

  const uniforms = {
    tMask: { value: null },
    tMaskDepth: { value: null },
    tSceneDepth: { value: null },
    uDepthAware: { value: false },
    tDustCoverage: { value: null },
    uHasDustCoverage: { value: false },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uOpacity: { value: 0 },
    uWidth: { value: 2.5 },
  };
  const contourMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tMask;
      uniform sampler2D tMaskDepth;
      uniform sampler2D tSceneDepth;
      uniform bool uDepthAware;
      uniform sampler2D tDustCoverage;
      uniform bool uHasDustCoverage;
      uniform vec2 uResolution;
      uniform float uOpacity;
      uniform float uWidth;
      varying vec2 vUv;
      ${DUST_OCCLUSION_GLSL}
      void main() {
        float center = texture2D(tMask, vUv).r;
        if (center >= .999) discard;
        vec2 stepPx = vec2(uWidth) / uResolution;
        float sceneDepth = uDepthAware ? texture2D(tSceneDepth, vUv).r : 1.0;
        float nearby = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.78539816339;
          vec2 tap = vUv + vec2(cos(a), sin(a)) * stepPx;
          float coverage = texture2D(tMask, tap).r;
          if (uDepthAware && coverage > 0.0 &&
              texture2D(tMaskDepth, tap).r > sceneDepth + .00005) coverage = 0.0;
          nearby = max(nearby, coverage);
        }
        float edge = nearby * (1.0 - center);
        if (uHasDustCoverage) edge *= dustInkTransmission(texture2D(tDustCoverage, vUv).a);
        gl_FragColor = vec4(vec3(1.0), edge * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), contourMaterial);
  quad.frustumCulled = false;
  const screen = new THREE.Scene();
  screen.add(quad);
  const screenCamera = new THREE.Camera();
  const size = new THREE.Vector2();
  let maskTarget;
  let passCount = 0;

  function render(opacity, dustCoverage = null, sceneDepth = null) {
    passCount = 0;
    if (opacity <= .005 || !mesh.visible) return;
    renderer.getDrawingBufferSize(size);
    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));
    if (!maskTarget || maskTarget.width !== width || maskTarget.height !== height) {
      maskTarget?.depthTexture?.dispose();
      maskTarget?.dispose();
      maskTarget = new THREE.WebGLRenderTarget(width, height, { depthBuffer: depthAware,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      if (depthAware) {
        maskTarget.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
        uniforms.tMaskDepth.value = maskTarget.depthTexture;
      }
      uniforms.tMask.value = maskTarget.texture;
      uniforms.uResolution.value.set(width, height);
    }
    const oldTarget = renderer.getRenderTarget();
    const oldClear = renderer.autoClear;
    try {
      renderer.setRenderTarget(maskTarget);
      renderer.autoClear = true;
      renderer.render(maskScene, camera);
      passCount++;
      uniforms.uOpacity.value = opacity;
      uniforms.tSceneDepth.value = sceneDepth;
      uniforms.uDepthAware.value = depthAware && Boolean(sceneDepth);
      uniforms.tDustCoverage.value = dustCoverage;
      uniforms.uHasDustCoverage.value = Boolean(dustCoverage);
      renderer.setRenderTarget(oldTarget);
      renderer.autoClear = false; // preserve the already rendered world
      renderer.render(screen, screenCamera);
      passCount++;
    } finally {
      renderer.autoClear = oldClear;
      renderer.setRenderTarget(oldTarget);
    }
  }

  function dispose() {
    maskTarget?.depthTexture?.dispose();
    maskTarget?.dispose();
    quad.geometry.dispose();
    contourMaterial.dispose();
    maskMaterial.dispose();
  }
  return { render, dispose, getPassCount: () => passCount };
}
