// Give only the carried model this light. Forge materials are also shared by
// floor keys, inserted keys and thumbnails.
export function addHeldKeyWindowLight(model, strength, warmth = { value: 0 }) {
  const materials = new Map();
  const originals = [];
  function lightMaterial(source) {
    if (!source.isMeshStandardMaterial) return source;
    if (!materials.has(source)) {
      const material = source.clone();
      material.onBeforeCompile = (shader, renderer) => {
        source.onBeforeCompile(shader, renderer);
        shader.uniforms.uHeldKeyWindowLight = strength;
        shader.uniforms.uWindowWarmth = warmth;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uHeldKeyWindowLight;\nuniform float uWindowWarmth;')
          .replace('#include <opaque_fragment>', `
            vec3 windowDirection = transformDirection(normalize(vec3(-.80, .58, .13)), viewMatrix);
            float windowFacing = max(0.0, dot(normal, windowDirection));
            vec3 halfWindow = normalize(windowDirection + normalize(vViewPosition));
            float glint = pow(max(0.0, dot(normal, halfWindow)), mix(28.0, 8.0, roughnessFactor))
              * windowFacing * (1.0 - .67 * roughnessFactor) * (.22 + .78 * metalnessFactor);
            vec3 windowDiffuse = diffuseColor.rgb * mix(vec3(.38, .49, .64), vec3(.62, .48, .31), uWindowWarmth)
              + mix(vec3(.033, .053, .081), vec3(.080, .053, .027), uWindowWarmth);
            outgoingLight += uHeldKeyWindowLight *
              (windowDiffuse * (.32 + .68 * windowFacing) + glint * mix(vec3(.15, .23, .34), vec3(.32, .23, .13), uWindowWarmth));
            #include <opaque_fragment>
          `);
      };
      material.customProgramCacheKey = () => source.customProgramCacheKey() + ':held-window-light';
      materials.set(source, material);
    }
    return materials.get(source);
  }

  model.traverse(object => {
    if (!object.isMesh) return;
    originals.push([object, object.material]);
    object.material = Array.isArray(object.material) ? object.material.map(lightMaterial) : lightMaterial(object.material);
  });
  return () => {
    for (const [object, material] of originals) object.material = material;
    for (const material of materials.values()) material.dispose();
  };
}
