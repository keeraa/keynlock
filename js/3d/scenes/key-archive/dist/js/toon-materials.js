import * as THREE from '../vendor/three.js';

const clamp01 = n => Math.max(0, Math.min(1, Number(n) || 0));

// A stepped lighting ramp shared by every illustrated surface. The gradient
// texture can be updated without recompiling the materials or creating meshes.
export function makeToonRamp(steps, strength) {
  const bands = Math.max(2, Math.min(8, Math.round(steps) || 4));
  const mix = clamp01(strength);
  const bytes = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const light = i / 255;
    const band = Math.min(bands - 1, Math.floor(light * bands)) / (bands - 1);
    const painted = .18 + band * .82;
    const shade = Math.round(Math.min(1, (light * (1 - mix) + painted * mix)) * 255);
    bytes.set([shade, shade, shade, 255], i * 4);
  }
  return bytes;
}

// Material-level toon lighting remains functional even on GPUs that reject
// the optional fullscreen outline/brush shader.
export function createToonMaterials(scene, renderer) {
  const original = new WeakMap();
  const tracked = new Set();
  const alternatives = new WeakMap();
  const generated = new Set();
  const gradient = new THREE.DataTexture(makeToonRamp(4, .72), 256, 1,
    THREE.RGBAFormat, THREE.UnsignedByteType);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const normalExposure = renderer.toneMappingExposure;
  let enabled = false;

  function toonFor(material) {
    // Invisible hit zones, glass, snow and luminescent elements retain their
    // original materials and alpha behavior.
    if (!material?.isMeshStandardMaterial || material.transparent || material.opacity < .999)
      return material;
    let converted = alternatives.get(material);
    if (converted) return converted;
    converted = new THREE.MeshToonMaterial({
      name: `${material.name || 'KEYNLOCK metal/wood'} · иллюстрация`,
      color: material.color.clone(),
      map: material.map,
      emissive: material.emissive.clone(),
      emissiveMap: material.emissiveMap,
      emissiveIntensity: material.emissiveIntensity,
      gradientMap: gradient,
      normalMap: material.normalMap,
      normalScale: material.normalScale?.clone(),
      alphaMap: material.alphaMap,
      alphaTest: material.alphaTest,
      side: material.side,
      vertexColors: material.vertexColors,
      wireframe: material.wireframe,
      fog: material.fog,
      toneMapped: material.toneMapped,
    });
    alternatives.set(material, converted);
    generated.add(converted);
    return converted;
  }

  function replacement(material) {
    return Array.isArray(material) ? material.map(toonFor) : toonFor(material);
  }

  function register(root) {
    root.traverse(node => {
      if (!node.isMesh || tracked.has(node)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (!materials.some(material => material?.isMeshStandardMaterial && !material.transparent)) return;
      tracked.add(node);
      original.set(node, node.material);
      if (enabled) node.material = replacement(node.material);
    });
  }

  function unregister(root) {
    root.traverse(node => {
      if (!tracked.delete(node)) return;
      node.material = original.get(node);
      original.delete(node);
    });
  }

  function setSettings(settings) {
    const strength = clamp01(settings.toonLight / 100) * clamp01(settings.cartoonMaterial / 100);
    const nextEnabled = Boolean(settings.toonEnabled && strength > 0);
    gradient.image.data.set(makeToonRamp(settings.toonSteps, strength));
    gradient.needsUpdate = true;
    if (enabled !== nextEnabled) {
      enabled = nextEnabled;
      for (const node of tracked) node.material = enabled ? replacement(original.get(node)) : original.get(node);
    }
    // Reduce the overly bright physical-material exposure when inked lighting
    // is on; this makes lighting bands distinguishable even in the bright hall.
    renderer.toneMappingExposure = normalExposure - (enabled ? strength * .38 : 0);
  }

  function dispose() {
    for (const node of tracked) node.material = original.get(node);
    tracked.clear();
    renderer.toneMappingExposure = normalExposure;
    for (const material of generated) material.dispose();
    generated.clear();
    gradient.dispose();
  }

  register(scene);
  return { register, unregister, setSettings, dispose };
}
