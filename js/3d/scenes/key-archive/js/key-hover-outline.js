import * as THREE from '../vendor/three.js';

// The hovered key is drawn into a flat silhouette mask. A screen-space edge
// around that mask is continuous even at sharp corners and inside key holes.
export function createKeyHoverOutline(renderer, camera, mesh) {
  const maskScene = new THREE.Scene();
  maskScene.background = new THREE.Color(0x000000);
  const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide,
    depthTest: false, depthWrite: false, toneMapped: false });
  mesh.material = maskMaterial;
  mesh.visible = false;
  maskScene.add(mesh);

  const uniforms = {
    tMask: { value: null },
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
      uniform vec2 uResolution;
      uniform float uOpacity;
      uniform float uWidth;
      varying vec2 vUv;
      void main() {
        float center = texture2D(tMask, vUv).r;
        vec2 stepPx = vec2(uWidth) / uResolution;
        float nearby = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.78539816339;
          nearby = max(nearby, texture2D(tMask,
            vUv + vec2(cos(a), sin(a)) * stepPx).r);
        }
        float edge = nearby * (1.0 - center);
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

  function render(opacity) {
    passCount = 0;
    if (opacity <= .005 || !mesh.visible) return;
    renderer.getDrawingBufferSize(size);
    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));
    if (!maskTarget || maskTarget.width !== width || maskTarget.height !== height) {
      maskTarget?.dispose();
      maskTarget = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
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
    maskTarget?.dispose();
    quad.geometry.dispose();
    contourMaterial.dispose();
    maskMaterial.dispose();
  }
  return { render, dispose, getPassCount: () => passCount };
}
