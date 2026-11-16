import { gradeWoodTexture, applyWoodTexture } from './wood-materials.js';

/** Wood finishes, swatches and their texture lifecycle. */
export function createWoodStyle({ THREE, renderer, loader, mats, wallpaperMaterial,
  floorWoodMaterials, variants }) {
  const selected = { easel: 1, frame: 1 };
  let textures = [];

  function setVariant(target, index) {
    if (!(target in selected) || !variants[index]) return;
    selected[target] = index;
    document.querySelectorAll(`.wood-option[data-target="${target}"]`).forEach((button) => {
      const active = Number(button.dataset.wood) === index;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!textures.length) return;
    const texture = textures[index];
    const materials = target === 'easel' ? [
      [mats.easel, '#e8dfd0'],
      [mats.easelEdge, '#fff2da'],
      [mats.deepWood, '#c7b8a3'],
    ] : [[mats.frameWood, '#e8dfd0']];
    applyWoodTexture(materials, texture);
  }

  document.querySelectorAll('.wood-option').forEach((button) => {
    button.addEventListener('click', () => setVariant(button.dataset.target, Number(button.dataset.wood)));
  });

  async function initialize() {
    const [loadedWood, wallpaper] = await Promise.all([
      Promise.all(variants.map(async (variant) => {
        const source = await loader.loadAsync(variant.image);
        const texture = gradeWoodTexture({ THREE, texture: source, grade: variant.grade });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return texture;
      })),
      loader.loadAsync('/textures/atelier-wallpaper-gouache.webp'),
    ]);
    textures = loadedWood;
    wallpaper.colorSpace = THREE.SRGBColorSpace;
    wallpaper.wrapS = wallpaper.wrapT = THREE.ClampToEdgeWrapping;
    wallpaper.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    wallpaperMaterial.map = wallpaper;
    wallpaperMaterial.needsUpdate = true;

    const floorTexture = textures[1].clone();
    floorTexture.center.set(.5, .5);
    floorTexture.rotation = Math.PI / 2;
    floorTexture.repeat.set(3.5, 1.25);
    floorTexture.needsUpdate = true;
    floorWoodMaterials.forEach((material) => {
      material.map = floorTexture;
      material.needsUpdate = true;
    });
    applyWoodTexture([
      [mats.roomWood, '#c7b8a3'],
      [mats.roomEdge, '#e8dfd0'],
    ], textures[1]);
    for (const [target, index] of Object.entries(selected)) setVariant(target, index);
  }

  return { initialize, setVariant };
}
