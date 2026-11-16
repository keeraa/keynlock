// The room is blurred separately, then the entire real scene is captured for
// a final refractive lens pass. Glass samples what is actually BEHIND it:
// shelves, supports, other bottles, and liquid, not just the wall texture.
import { ROOM_BLUR_GLSL } from '../../../core/rendering/background-blur.js';
export function createBackgroundEffects(THREE, renderer, backgroundScene) {
  const roomTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true, stencilBuffer: false
  });
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true, stencilBuffer: false
  });
  sceneTarget.texture.colorSpace = THREE.SRGBColorSpace;
  sceneTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const pixel = new THREE.Vector2(1, 1);
  // The room is static; only changes to its camera, lighting, materials or
  // viewport need a new backdrop capture. Foreground liquids stay live.
  const lastCameraMatrix = new THREE.Matrix4();
  const lastProjection = new THREE.Matrix4();
  let roomValid = false;
  const blurUniform = { value: 1 };
  const timeUniform = { value: 0 };
  const passMaterial = new THREE.ShaderMaterial({
    uniforms: { tRoom: { value: roomTarget.texture }, uPixel: { value: pixel }, uBlur: blurUniform },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tRoom;
      uniform vec2 uPixel;
      uniform float uBlur;
      varying vec2 vUv;
      ${ROOM_BLUR_GLSL}
      void main() {
        gl_FragColor = keynlockRoomBlur(tRoom, vUv, uPixel, uBlur);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const passScene = new THREE.Scene();
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  passScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), passMaterial));

  const copyScene = new THREE.Scene();
  const copyMaterial = new THREE.MeshBasicMaterial({
    map: sceneTarget.texture, depthTest: false, depthWrite: false, toneMapped: false
  });
  copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial));

  const glassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneTarget.texture },
      tDepth: { value: sceneTarget.depthTexture },
      uPixel: { value: pixel }, uTime: timeUniform,
      uCenter: { value: new THREE.Vector2(.5, .5) }, uFluidY: { value: -1 }
    },
    transparent: true, depthTest: true, depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: `varying vec2 vUv;
      varying vec3 vNormal;
      varying float vLocalY;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vLocalY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform sampler2D tScene;
      uniform sampler2D tDepth;
      uniform vec2 uPixel;
      uniform vec2 uCenter;
      uniform float uTime;
      uniform float uFluidY;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vLocalY;
      void main() {
        vec2 screenUv = gl_FragCoord.xy * uPixel;
        // Keep solid foreground objects, including paper labels, in front.
        float capturedDepth = texture2D(tDepth, screenUv).r;
        if (gl_FragCoord.z > capturedDepth + .000045) discard;
        // Opaque pigment covers most glass pixels. Skip expensive refractive
        // samples where the glass contribution is effectively invisible.
        float clearGlass = smoothstep(uFluidY - .025, uFluidY + .13, vLocalY);
        if (clearGlass < .001) discard;
        // An actual lens slightly magnifies scene geometry inside its contour.
        float wave = sin(vUv.y * 17.0 + uTime * .33 + sin(vUv.x * 6.283185) * 1.1);
        vec2 normalShift = vNormal.xy * .0012 + vec2(wave, cos(vUv.y * 11.0 - uTime * .24)) * .00018;
        vec2 magnified = uCenter + (screenUv - uCenter) * .991;
        vec2 q = clamp(magnified + normalShift, vec2(.002), vec2(.998));
        vec3 sceneColor = texture2D(tScene, q).rgb;
        vec3 blurred = (texture2D(tScene, q + vec2(uPixel.x * 1.7, 0.0)).rgb +
          texture2D(tScene, q - vec2(uPixel.x * 1.7, 0.0)).rgb +
          texture2D(tScene, q + vec2(0.0, uPixel.y * 1.7)).rgb +
          texture2D(tScene, q - vec2(0.0, uPixel.y * 1.7)).rgb) * .25;
        // Dense fluid stays opaque; only glass above it acts as a lens.
        // Clear center, stronger refractive edges: liquid color remains crisp.
        float lensEdge = pow(1.0 - abs(normalize(vNormal).z), 1.5);
        float softness = .015 + .035 * lensEdge;
        gl_FragColor = vec4(mix(sceneColor, blurred, softness), (.045 + .13 * lensEdge) * clearGlass);
        #include <colorspace_fragment>
      }`
  });

  // Each lens has its own projected center and liquid level; textures, depth
  // and time are common uniforms that stay synchronized on resize.
  function makeGlassMaterial() {
    return new THREE.ShaderMaterial({
      vertexShader: glassMaterial.vertexShader,
      fragmentShader: glassMaterial.fragmentShader,
      uniforms: {
        tScene: glassMaterial.uniforms.tScene,
        tDepth: glassMaterial.uniforms.tDepth,
        uPixel: glassMaterial.uniforms.uPixel,
        uTime: glassMaterial.uniforms.uTime,
        uCenter: { value: new THREE.Vector2(.5, .5) },
        uFluidY: { value: -1 }
      },
      transparent: true, depthTest: true, depthWrite: false,
      side: THREE.FrontSide
    });
  }

  renderer.autoClear = false;
  if (renderer.info) renderer.info.autoReset = false;

  function resize(width, height) {
    const ratio = renderer.getPixelRatio?.() || 1;
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    roomTarget.setSize(w, h);
    sceneTarget.setSize(w, h);
    pixel.set(1 / w, 1 / h);
    roomValid = false;
  }
  function invalidateRoom() { roomValid = false; }
  function setBlur(active) { blurUniform.value = active ? 1 : 0; }
  function render(scene, camera, time = 0) {
    timeUniform.value = time;
    renderer.info?.reset?.();
    if (!roomValid || !lastCameraMatrix.equals(camera.matrixWorld) || !lastProjection.equals(camera.projectionMatrix)) {
      renderer.setRenderTarget(roomTarget);
      renderer.clear();
      renderer.render(backgroundScene, camera);
      lastCameraMatrix.copy(camera.matrixWorld);
      lastProjection.copy(camera.projectionMatrix);
      roomValid = true;
    }

    // Capture the actual room, foreground solids, liquid, and glass, while
    // excluding the refractor-only layer to avoid a reflection feedback loop.
    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(passScene, passCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(copyScene, passCamera);
    renderer.clearDepth();
    const previousMask = camera.layers.mask;
    camera.layers.set(1);
    renderer.render(scene, camera);
    camera.layers.mask = previousMask;
  }
  return { resize, invalidateRoom, setBlur, render, glassMaterial, makeGlassMaterial, getBlur: () => blurUniform.value > 0,
    sceneTarget, roomTarget };
}
