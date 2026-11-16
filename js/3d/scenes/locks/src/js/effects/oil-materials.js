/** Small shared opacity palettes avoid allocating a GPU material for each oil mark. */
export function createOilMaterialPalettes(THREE, blotTexture, runTexture, opacityStep = .04) {
  function palette(initial, minimum, texture, roughness) {
    const stages = Math.ceil((initial - minimum) / opacityStep);
    return Array.from({ length: stages + 1 }, (_, i) => new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      opacity: Math.max(minimum, initial - i * opacityStep),
      metalness: 0,
      roughness,
      clearcoat: 1,
      clearcoatRoughness: roughness === .13 ? .08 : .06,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }));
  }
  const blots = palette(.78, .24, blotTexture, .13);
  const runs = palette(.64, .18, runTexture, .10);
  function atOpacity(materials, initial, minimum, wanted) {
    const index = Math.round((initial - Math.max(minimum, Math.min(initial, wanted))) / opacityStep);
    return materials[Math.min(materials.length - 1, Math.max(0, index))];
  }
  return {
    blot: atOpacity.bind(null, blots, .78, .24),
    run: atOpacity.bind(null, runs, .64, .18),
    blotMaterials: blots,
    runMaterials: runs,
  };
}
