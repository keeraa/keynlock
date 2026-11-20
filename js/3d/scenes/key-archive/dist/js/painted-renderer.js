import * as THREE from '../vendor/three.js';
import { applySceneOutlineSettings } from './scene-outline.js';
import { createToonShader, createOutlineShader, createCopyShader, createDistanceBlurShader } from './painted-shader.js';

// Independent GPU passes: toon -> contours. Failure in one stage
// cannot disable the others. The scene itself is always the final fallback.
export function createPaintedRenderer(renderer, scene, camera, initialSettings) {
  const postCamera = new THREE.Camera();
  function makePass(createShader) {
    const { shader, uniforms } = createShader();
    const passScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shader);
    quad.frustumCulled = false;
    passScene.add(quad);
    return { shader, uniforms, scene: passScene, quad };
  }
  const stages = {
    toon: { ...makePass(createToonShader), failed: false, pending: true, error: '' },
    outline: { ...makePass(createOutlineShader), failed: false, pending: true, error: '' },
    distanceBlur: { ...makePass(createDistanceBlurShader), failed: false, pending: true, error: '' },
  };
  const copy = makePass(createCopyShader);
  let settings = initialSettings;
  let sceneTarget = null;
  let intermediateTargets = [];
  let normalTarget = null;
  let normalMaterial = null;
  let currentWidth = 0;
  let currentHeight = 0;
  let passCount = 0;
  let lastPipelineError = '';
  let dustCoverage = null;
  const bufferSize = new THREE.Vector2();
  const sample = new Uint8Array(4);
  // The antialias flag only covers the default framebuffer. Geometry is
  // rendered offscreen here, so resolve coverage before the fullscreen passes.
  const geometrySamples = renderer.capabilities?.maxSamples >= 2 ? 2 : 0;

  function active(name) {
    if (name === 'toon') return settings.toonEnabled && settings.toonLight > 0 && settings.cartoonMaterial > 0;
    if (name === 'outline') return settings.outlineEnabled && settings.outlineStrength > 0;
    return true;
  }

  function makeTarget(width, height, { depth = false, readDepth = false } = {}) {
    const target = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: depth, stencilBuffer: false, samples: depth ? geometrySamples : 0,
      resolveDepthBuffer: readDepth,
    });
    if (readDepth) {
      const texture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
      texture.format = THREE.DepthFormat;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      target.depthTexture = texture;
    }
    return target;
  }

  function resize() {
    renderer.getDrawingBufferSize(bufferSize);
    const width = Math.max(1, Math.floor(bufferSize.x));
    const height = Math.max(1, Math.floor(bufferSize.y));
    if (sceneTarget && width === currentWidth && height === currentHeight) return;
    sceneTarget?.depthTexture?.dispose();
    sceneTarget?.dispose();
    for (const target of intermediateTargets) target.dispose();
    normalTarget?.depthTexture?.dispose();
    normalTarget?.dispose();
    normalTarget = null;
    normalMaterial?.dispose();
    normalMaterial = null;
    currentWidth = width;
    currentHeight = height;
    sceneTarget = makeTarget(width, height, { depth: true, readDepth: true });
    intermediateTargets = [makeTarget(width, height), makeTarget(width, height)];
    const outline = stages.outline.uniforms;
    outline.tDustCoverage.value = sceneTarget.texture;
    outline.uResolution.value.set(width, height);
    outline.uNear.value = camera.near;
    outline.uFar.value = camera.far;
    const blur = stages.distanceBlur.uniforms;
    blur.tDepth.value = sceneTarget.depthTexture;
    blur.uResolution.value.set(width, height);
    blur.uNear.value = camera.near;
    blur.uFar.value = camera.far;
    for (const stage of Object.values(stages)) stage.pending = true;
  }

  function renderNormals() {
    if (!normalTarget) {
      normalTarget = makeTarget(currentWidth, currentHeight, { depth: true, readDepth: true });
      normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      normalMaterial.toneMapped = false;
    }
    const outline = stages.outline.uniforms;
    outline.tNormal.value = normalTarget.texture;
    outline.tDepth.value = normalTarget.depthTexture;
    const hidden = [];
    const prior = scene.overrideMaterial;
    scene.traverse(object => {
      if (!object.visible) return;
      if (object.isPoints || object.isLine || object.isSprite || (object.isMesh &&
          (Array.isArray(object.material) ? object.material : [object.material])
            .some(material => material?.transparent))) {
        hidden.push(object);
        object.visible = false;
      }
    });
    try {
      scene.overrideMaterial = normalMaterial;
      renderer.setRenderTarget(normalTarget);
      renderer.render(scene, camera);
      passCount++;
    } finally {
      scene.overrideMaterial = prior;
      for (const object of hidden) object.visible = true;
    }
  }

  // Validates actual stage output, not browser-dependent default framebuffer
  // pixels. A flat original scene (e.g. a wall filling the view) is legitimate.
  function looksBlank(before, after) {
    const points = [[.18,.22], [.52,.47], [.83,.72]];
    const spread = target => {
      const samples = [];
      for (const [x, y] of points) {
        renderer.readRenderTargetPixels(target,
          Math.min(target.width - 1, Math.floor(target.width * x)),
          Math.min(target.height - 1, Math.floor(target.height * y)), 1, 1, sample);
        samples.push([sample[0], sample[1], sample[2]]);
      }
      return Math.max(...[0,1,2].map(channel =>
        Math.max(...samples.map(s => s[channel])) - Math.min(...samples.map(s => s[channel]))));
    };
    return spread(before) > 30 && spread(after) < 3;
  }

  function setSettings(next) {
    settings = next;
    lastPipelineError = '';
    for (const stage of Object.values(stages)) {
      stage.failed = false;
      stage.pending = true;
      stage.error = '';
    }
    const airColor = stages.distanceBlur.uniforms.uAirColor;
    if (airColor) airColor.value.setRGB(...(next.nightLighting ? [.20, .26, .33] : [.30, .325, .30]));
    stages.toon.uniforms.uToonLight.value = next.toonEnabled ? next.toonLight / 100 : 0;
    stages.toon.uniforms.uSteps.value = next.toonSteps;
    stages.toon.uniforms.uMaterial.value = next.cartoonMaterial / 100;
    applySceneOutlineSettings(stages.outline.uniforms, next, renderer.getPixelRatio());
    if (!active('outline')) {
      normalTarget?.depthTexture?.dispose();
      normalTarget?.dispose();
      normalTarget = null;
      normalMaterial?.dispose();
      normalMaterial = null;
    }
  }

  function render() {
    renderer.info.reset();
    passCount = 0;
    dustCoverage = null;
    if (!Object.keys(stages).some(name => active(name) && !stages[name].failed)) {
      renderer.render(scene, camera);
      passCount++;
      return;
    }
    const originalTarget = renderer.getRenderTarget();
    try {
      resize();
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      passCount++;
      dustCoverage = sceneTarget.texture;
      let source = sceneTarget;
      let nextTarget = 0;
      let presented = false;
      const lastActive = Object.keys(stages).filter(name => active(name) && !stages[name].failed).at(-1);
      for (const [name, stage] of Object.entries(stages)) {
        if (!active(name) || stage.failed) continue;
        const isLast = name === lastActive;
        // A validated last stage can draw straight to screen, skipping the
        // otherwise redundant copy pass on every subsequent frame.
        const toScreen = isLast && !stage.pending;
        const destination = toScreen ? originalTarget : intermediateTargets[nextTarget];
        try {
          if (name === 'outline') renderNormals();
          stage.uniforms.tScene.value = source.texture;
          renderer.setRenderTarget(destination);
          renderer.render(stage.scene, postCamera);
          passCount++;
          if (stage.pending && looksBlank(source, destination)) {
            throw new Error('GPU pass produced a blank image');
          }
          if (isLast && stage.pending) {
            renderer.setRenderTarget(originalTarget);
            renderer.render(stage.scene, postCamera);
            passCount++;
          }
          stage.pending = false;
          if (isLast) presented = true;
          else {
            source = destination;
            nextTarget = 1 - nextTarget;
          }
        } catch (error) {
          stage.failed = true;
          stage.error = error.message || String(error);
          console.warn(`KEYNLOCK: ${name} temporarily disabled:`, error);
        }
      }
      if (!presented) {
        copy.uniforms.tScene.value = source.texture;
        renderer.setRenderTarget(originalTarget);
        renderer.render(copy.scene, postCamera);
        passCount++;
      }
    } catch (error) {
      dustCoverage = null;
      lastPipelineError = error.message || String(error);
      renderer.setRenderTarget(originalTarget);
      console.error('KEYNLOCK: visual framebuffer unavailable:', error);
      renderer.render(scene, camera);
      passCount++;
    } finally {
      renderer.setRenderTarget(originalTarget);
    }
  }

  function getStatus() {
    const enabled = Object.keys(stages).filter(active);
    const failed = enabled.filter(name => stages[name].failed);
    return {
      mode: lastPipelineError || failed.length ? 'error' : !enabled.length ? 'off' : 'active',
      error: [lastPipelineError, ...failed.map(name => `${name}: ${stages[name].error}`)].filter(Boolean).join('; '),
      stages: Object.fromEntries(Object.entries(stages).map(([name, stage]) =>
        [name, !active(name) ? 'off' : stage.failed ? 'error' : stage.pending ? 'checking' : 'active'])),
    };
  }

  function dispose() {
    sceneTarget?.depthTexture?.dispose();
    sceneTarget?.dispose();
    for (const target of intermediateTargets) target.dispose();
    normalTarget?.depthTexture?.dispose();
    normalTarget?.dispose();
    normalMaterial?.dispose();
    for (const stage of [...Object.values(stages), copy]) {
      stage.quad.geometry.dispose();
      stage.shader.dispose();
    }
  }

  setSettings(initialSettings);
  return { render, resize, setSettings, dispose, getPassCount: () => passCount, getDustCoverage: () => dustCoverage,
    getSceneDepth: () => dustCoverage ? sceneTarget.depthTexture : null, getStatus };
}
