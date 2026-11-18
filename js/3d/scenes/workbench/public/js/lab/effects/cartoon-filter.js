import { drawingVertexShader, drawingFragmentShader } from './drawing-shader.js';

/** Optional post-processing. The normal buffer exists only while contours are enabled. */
export function createCartoonFilter({ THREE, renderer, scene, camera }) {
  const options = {
    toon: false, toonStrength: .8, bands: 4,
    outline: false, outlineStrength: .7, outlineWidth: 1,
  };
  let width = 1, height = 1, resources = null;
  let normalTarget = null, normalMaterial = null;
  // Static geometry can reuse its exact normal buffer. Animated meshes and
  // camera movements invalidate it; the color/depth pass still runs each frame.
  const cachedNormals = new Map();
  const cachedCameraWorld = new THREE.Matrix4();
  const cachedCameraProjection = new THREE.Matrix4();
  let normalCacheValid = false, normalScan = 0;

  function enabled() {
    return (options.toon && options.toonStrength > 0) ||
      (options.outline && options.outlineStrength > 0);
  }

  function ensureResources() {
    if (resources) return resources;
    const target = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    const depth = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    target.depthTexture = depth;
    const uniforms = {
      tColor: { value: target.texture },
      tDepth: { value: depth },
      tNormal: { value: target.texture },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uToon: { value: 0 },
      uBands: { value: options.bands },
      uOutline: { value: 0 },
      uOutlineWidth: { value: options.outlineWidth },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: drawingVertexShader,
      fragmentShader: drawingFragmentShader, depthTest: false, depthWrite: false,
      transparent: true,
    });
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(quadGeometry, material);
    quad.frustumCulled = false;
    const screen = new THREE.Scene();
    screen.add(quad);
    resources = { target, uniforms, material, quadGeometry, screen, screenCamera: new THREE.Camera() };
    updateUniforms();
    return resources;
  }

  function releaseNormalTarget() {
    if (normalTarget) normalTarget.dispose();
    if (normalMaterial) normalMaterial.dispose();
    normalTarget = null;
    normalMaterial = null;
    normalCacheValid = false;
    cachedNormals.clear();
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
  }

  function renderNormalBuffer() {
    ensureNormalTarget();
    const previousMaterial = scene.overrideMaterial;
    const hidden = [];
    let dirty = !normalCacheValid ||
      !cachedCameraWorld.equals(camera.matrixWorld) ||
      !cachedCameraProjection.equals(camera.projectionMatrix);
    cachedCameraWorld.copy(camera.matrixWorld);
    cachedCameraProjection.copy(camera.projectionMatrix);
    const scan = ++normalScan;
    // Only visible geometry participates. A cached world matrix and attribute
    // revision tell us if rerendering the normal target would change a pixel.
    scene.traverseVisible(object => {
      // Atmospheric sprites belong only to the color pass, never the metal outline.
      if (object.isPoints && object.userData.atmosphere) {
        hidden.push(object);
        return;
      }
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material?.transparent && material.opacity < 1)) {
        hidden.push(object);
        return;
      }
      const geometry=object.geometry;
      const positionVersion=geometry?.attributes?.position?.version??0;
      const normalVersion=geometry?.attributes?.normal?.version??0;
      const indexVersion=geometry?.index?.version??0;
      const instanceVersion=object.instanceMatrix?.version??0;
      let record=cachedNormals.get(object);
      if(!record){
        dirty=true;
        record={world:object.matrixWorld.clone()};
        cachedNormals.set(object,record);
      }else if(!record.world.equals(object.matrixWorld) ||
        record.geometry!==geometry || record.positionVersion!==positionVersion ||
        record.normalVersion!==normalVersion || record.indexVersion!==indexVersion ||
        record.instanceVersion!==instanceVersion){
        dirty=true;
        record.world.copy(object.matrixWorld);
      }
      if(object.isSkinnedMesh||object.morphTargetInfluences?.length)dirty=true;
      Object.assign(record,{geometry,positionVersion,normalVersion,indexVersion,
        instanceVersion,seen:scan});
    });
    for(const [object,record] of cachedNormals){
      if(record.seen!==scan){cachedNormals.delete(object);dirty=true;}
    }
    if(!dirty)return {calls:0,triangles:0};
    try {
      for(const object of hidden)object.visible=false;
      scene.overrideMaterial = normalMaterial;
      renderer.setRenderTarget(normalTarget);
      renderer.render(scene, camera);
      normalCacheValid = true;
      return { ...renderer.info.render };
    }catch(error){
      normalCacheValid = false;
      throw error;
    } finally {
      scene.overrideMaterial = previousMaterial;
      for (const object of hidden) object.visible = true;
    }
  }

  function render() {
    if (!enabled()) {
      renderer.render(scene, camera);
      return { ...renderer.info.render };
    }
    const { target, screen, screenCamera, uniforms } = ensureResources();
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const frame = { ...renderer.info.render };
      const normalFrame = options.outline && options.outlineStrength > 0 ?
        renderNormalBuffer() : { calls: 0, triangles: 0 };
      renderer.setRenderTarget(previousTarget);
      renderer.render(screen, screenCamera);
      return {
        ...frame,
        sceneTriangles: frame.triangles,
        calls: (frame.calls || 0) + (normalFrame.calls || 0) + 1,
        triangles: (frame.triangles || 0) + (normalFrame.triangles || 0) + 2,
      };
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }

  function resize(cssWidth, cssHeight, pixelRatio = renderer.getPixelRatio()) {
    const nextWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    const nextHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    if(nextWidth!==width||nextHeight!==height)normalCacheValid=false;
    width=nextWidth;height=nextHeight;
    if (resources) {
      resources.target.setSize(width, height);
      resources.uniforms.uTexel.value.set(1 / width, 1 / height);
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

  // Backward-compatible entry points for older integrations.
  function setEnabled(value) {
    setOptions({ toon: !!value, outline: !!value });
  }
  function setOutline(value) { setOptions({ outlineStrength: Math.max(0, Math.min(1, value)) }); }

  function dispose() {
    releaseNormalTarget();
    if (!resources) return;
    resources.target.dispose();
    resources.target.depthTexture.dispose();
    resources.material.dispose();
    resources.quadGeometry.dispose();
    resources = null;
  }

  return { render, resize, setOptions, setEnabled, setOutline, dispose };
}
