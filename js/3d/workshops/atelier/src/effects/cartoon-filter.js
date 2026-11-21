// @ts-check
import { drawingVertexShader, drawingFragmentShader } from './drawing-shader.js';
import { backgroundBlurFragmentShader } from './background-blur-shader.js';

/** Optional post-processing. The normal buffer exists only while contours are enabled. */
export function createCartoonFilter({ THREE, renderer, scene, camera, renderScene = scene }) {
  const options = {
    toon: false, toonStrength: .8, bands: 4,
    outline: false, outlineStrength: .7, outlineWidth: 1,
    // Soft, continuous defocus behind the easels; radius is in CSS pixels.
    backgroundBlur: .72, backgroundRadius: 6.5,
    // In the standalone Atelier, the rear wall is several metres behind the
    // easels. A shared room can override the transition for closer walls.
    backgroundBlurNear: 1.1, backgroundBlurFar: 2.7, focus: 7.15,
  };
  let width = 1, height = 1, resources = null;
  let blurSuspended = false;
  let normalTarget = null, normalMaterial = null, inkMaskMaterial = null;
  const previousClearColor = new THREE.Color();

  const effectiveBackgroundBlur = () => blurSuspended ? 0 : options.backgroundBlur;

  function enabled() {
    return effectiveBackgroundBlur() > 0 ||
      (options.toon && options.toonStrength > 0) ||
      (options.outline && options.outlineStrength > 0);
  }

  function ensureResources() {
    if (resources) return resources;
    const target = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      samples: 2,
    });
    const depth = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    target.depthTexture = depth;
    const blurWidth = Math.ceil(width / 2);
    const blurHeight = Math.ceil(height / 2);
    const makeBlurTarget = () => new THREE.WebGLRenderTarget(blurWidth, blurHeight, {
      depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    const blurHorizontal = makeBlurTarget();
    const blurVertical = makeBlurTarget();
    const blurUniforms = {
      tSource: { value: target.texture },
      tDepth: { value: depth },
      uTexel: { value: new THREE.Vector2(1 / blurWidth, 1 / blurHeight) },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uFocus: { value: options.focus },
      uBlurRadius: { value: options.backgroundRadius * renderer.getPixelRatio() },
      uBlurNear: { value: options.backgroundBlurNear },
      uBlurFar: { value: options.backgroundBlurFar },
      uPremultiplied: { value: 0 },
    };
    const blurMaterial = new THREE.ShaderMaterial({
      uniforms: blurUniforms, vertexShader: drawingVertexShader,
      fragmentShader: backgroundBlurFragmentShader,
      depthTest: false, depthWrite: false,
    });
    const uniforms = {
      tColor: { value: target.texture },
      tDepth: { value: depth },
      tNormal: { value: target.texture },
      tBlur: { value: blurVertical.texture },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uToon: { value: 0 },
      uBands: { value: options.bands },
      uOutline: { value: 0 },
      uOutlineWidth: { value: options.outlineWidth },
      uFocus: { value: options.focus },
      uBackgroundBlur: { value: effectiveBackgroundBlur() },
      uBlurNear: { value: options.backgroundBlurNear },
      uBlurFar: { value: options.backgroundBlurFar },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: drawingVertexShader,
      fragmentShader: drawingFragmentShader, depthTest: false, depthWrite: false,
      transparent: true,
    });
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(quadGeometry, material);
    quad.frustumCulled = false;
    const blurQuad = new THREE.Mesh(quadGeometry, blurMaterial);
    blurQuad.frustumCulled = false;
    const screen = new THREE.Scene();
    screen.add(quad);
    const blurScene = new THREE.Scene();
    blurScene.add(blurQuad);
    resources = {
      target, uniforms, material, quadGeometry, screen,
      blurScene, blurMaterial, blurUniforms, blurHorizontal, blurVertical,
      screenCamera: new THREE.Camera(),
    };
    updateUniforms();
    return resources;
  }

  function releaseNormalTarget() {
    if (normalTarget) normalTarget.dispose();
    if (normalMaterial) normalMaterial.dispose();
    if (inkMaskMaterial) inkMaskMaterial.dispose();
    normalTarget = null;
    normalMaterial = null;
    inkMaskMaterial = null;
    // Keep a complete texture bound even if the outline branch is disabled.
    if (resources) resources.uniforms.tNormal.value = resources.target.texture;
  }

  function ensureNormalTarget() {
    if (!normalTarget) {
      normalTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: true, stencilBuffer: false,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      });
      normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      // Writes transparent pixels AND depth for selected meshes, preventing
      // the wall behind floor planks from bleeding into the normal buffer.
      inkMaskMaterial = new THREE.ShaderMaterial({
        vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
    }
    resources.uniforms.tNormal.value = normalTarget.texture;
  }

  function updateUniforms() {
    if (!resources) return;
    const u = resources.uniforms;
    u.uToon.value = options.toon ? options.toonStrength : 0;
    u.uBands.value = options.bands;
    u.uOutline.value = options.outline ? options.outlineStrength : 0;
    u.uOutlineWidth.value = options.outlineWidth;
    u.uBackgroundBlur.value = effectiveBackgroundBlur();
    u.uBlurNear.value = options.backgroundBlurNear;
    u.uBlurFar.value = options.backgroundBlurFar;
    u.uFocus.value = options.focus;
    const blur = resources.blurUniforms;
    blur.uFocus.value = options.focus;
    blur.uBlurRadius.value = options.backgroundRadius * renderer.getPixelRatio();
    blur.uBlurNear.value = options.backgroundBlurNear;
    blur.uBlurFar.value = options.backgroundBlurFar;
  }

  function renderNormalBuffer() {
    ensureNormalTarget();
    const previousMaterial = scene.overrideMaterial;
    const previousBackground = scene.background;
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const hidden = [];
    const swapped = [];
    // Transparent casings should not cover the internal pins in the normal buffer.
    scene.traverse(object => {
      // Atmospheric sprites belong only to the color pass, never the metal outline.
      if (object.isPoints && object.userData.atmosphere && object.visible) {
        object.visible = false;
        hidden.push(object);
        return;
      }
      if (!object.isMesh || !object.visible) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material?.transparent && material.opacity < 1)) {
        object.visible = false;
        hidden.push(object);
        return;
      }
      swapped.push([object, object.material]);
      object.material = object.userData.excludeFromInk ? inkMaskMaterial : normalMaterial;
    });
    try {
      scene.overrideMaterial = null;
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(normalTarget);
      renderer.render(scene, camera);
      return { ...renderer.info.render };
    } finally {
      scene.overrideMaterial = previousMaterial;
      scene.background = previousBackground;
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      for (const [object, material] of swapped) object.material = material;
      for (const object of hidden) object.visible = true;
    }
  }

  function render() {
    if (!enabled()) {
      renderer.render(renderScene, camera);
      return { ...renderer.info.render };
    }
    const {
      target, screen, screenCamera, uniforms,
      blurScene, blurUniforms, blurHorizontal, blurVertical,
    } = ensureResources();
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    blurUniforms.uNear.value = camera.near;
    blurUniforms.uFar.value = camera.far;
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      renderer.render(renderScene, camera);
      const frame = { ...renderer.info.render };
      const normalFrame = options.outline && options.outlineStrength > 0 ?
        renderNormalBuffer() : { calls: 0, triangles: 0 };
      const blurPasses = effectiveBackgroundBlur() > 0 ? 2 : 0;
      if (blurPasses) {
        blurUniforms.tSource.value = target.texture;
        blurUniforms.uDirection.value.set(1, 0);
        blurUniforms.uPremultiplied.value = 0;
        renderer.setRenderTarget(blurHorizontal);
        renderer.render(blurScene, screenCamera);

        blurUniforms.tSource.value = blurHorizontal.texture;
        blurUniforms.uDirection.value.set(0, 1);
        blurUniforms.uPremultiplied.value = 1;
        renderer.setRenderTarget(blurVertical);
        renderer.render(blurScene, screenCamera);
      }
      renderer.setRenderTarget(previousTarget);
      renderer.render(screen, screenCamera);
      return {
        ...frame,
        sceneTriangles: frame.triangles,
        calls: (frame.calls || 0) + (normalFrame.calls || 0) + 1 + blurPasses,
        triangles: (frame.triangles || 0) + (normalFrame.triangles || 0) + 2 + blurPasses * 2,
      };
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }

  function resize(cssWidth, cssHeight, pixelRatio = renderer.getPixelRatio()) {
    width = Math.max(1, Math.round(cssWidth * pixelRatio));
    height = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (resources) {
      resources.target.setSize(width, height);
      resources.uniforms.uTexel.value.set(1 / width, 1 / height);
      const blurWidth = Math.ceil(width / 2);
      const blurHeight = Math.ceil(height / 2);
      resources.blurHorizontal.setSize(blurWidth, blurHeight);
      resources.blurVertical.setSize(blurWidth, blurHeight);
      resources.blurUniforms.uTexel.value.set(1 / blurWidth, 1 / blurHeight);
      resources.blurUniforms.uBlurRadius.value = options.backgroundRadius * pixelRatio;
    }
    if (normalTarget) normalTarget.setSize(width, height);
  }

  function setOptions(next) {
    for (const key of Object.keys(options)) {
      if (Object.hasOwn(next, key)) options[key] = next[key];
    }
    if (!enabled()) {
      dispose();
    } else {
      ensureResources();
      if (!options.outline || options.outlineStrength <= 0) releaseNormalTarget();
      updateUniforms();
    }
  }

  // Temporarily keep every artwork sharp in the wall collection without
  // overwriting the visitor's saved blur strength or radius.
  function setBlurSuspended(value) {
    if (blurSuspended === Boolean(value)) return;
    blurSuspended = Boolean(value);
    if (!enabled()) dispose();
    else updateUniforms();
  }

  // Backward-compatible entry points for older integrations.
  function setEnabled(value) {
    setOptions({ toon: !!value, outline: !!value });
  }
  function setOutline(value) { setOptions({ outlineStrength: Math.max(0, Math.min(1, value)) }); }

  function setFocus(distance) {
    options.focus = distance;
    if (resources) {
      resources.uniforms.uFocus.value = distance;
      resources.blurUniforms.uFocus.value = distance;
    }
  }

  function dispose() {
    releaseNormalTarget();
    if (!resources) return;
    resources.target.dispose();
    resources.target.depthTexture.dispose();
    resources.blurHorizontal.dispose();
    resources.blurVertical.dispose();
    resources.blurMaterial.dispose();
    resources.material.dispose();
    resources.quadGeometry.dispose();
    resources = null;
  }

  return { render, resize, setOptions, setBlurSuspended, setEnabled, setOutline, setFocus, dispose };
}
