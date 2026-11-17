import { gradeWoodTexture, applyWoodTexture } from './wood-materials.js';
import { atelierWoodSources, atelierWallpaperSource } from './painted-assets.js';

/** Wood finishes, swatches and their texture lifecycle. */
export function createWoodStyle({ THREE, renderer, loader, mats, wallpaperMaterial,
  floorWoodMaterials, variants }) {
  const selected = { easel: 1, frame: 2 };
  let textures = [];
  const fallbackColors = ['#c38e58', '#72503b', '#bdb0a1'];

  function setVariant(target, index) {
    if (!(target in selected) || !variants[index]) return;
    selected[target] = index;
    document.querySelectorAll(`.wood-option[data-target="${target}"]`).forEach((button) => {
      const active = Number(button.dataset.wood) === index;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const texture = textures[index];
    const materials = target === 'easel' ? [
      [mats.easel, '#e8dfd0'],
      [mats.easelEdge, '#fff2da'],
      [mats.deepWood, '#c7b8a3'],
    ] : [[mats.frameWood, '#e8dfd0']];
    if (texture) applyWoodTexture(materials, texture);
    else for (const [material] of materials) {
      material.map = null;
      material.color.set(fallbackColors[index]);
      material.needsUpdate = true;
    }
  }

  document.querySelectorAll('.wood-option').forEach((button) => {
    button.addEventListener('click', () => setVariant(button.dataset.target, Number(button.dataset.wood)));
  });

  async function initialize() {
    // The original gouache wallpaper must not wait for three other textures.
    // Each swatch also has its own failure boundary: one broken download must
    // never leave every easel, frame and wall as untextured flat geometry.
    const wallpaperReady = loader.loadAsync(atelierWallpaperSource)
      .then((wallpaper) => {
        wallpaper.colorSpace = THREE.SRGBColorSpace;
        wallpaper.wrapS = wallpaper.wrapT = THREE.ClampToEdgeWrapping;
        wallpaper.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        wallpaperMaterial.map = wallpaper;
        wallpaperMaterial.color.set('#ffffff');
        wallpaperMaterial.needsUpdate = true;
      }).catch(error => console.error('Не удалось загрузить гуашевые обои:', error));
    const loadedWood = await Promise.allSettled(variants.map(async (variant, index) => {
      const source = await loader.loadAsync(atelierWoodSources[index] || variant.image);
      let texture;
      try { texture = gradeWoodTexture({ THREE, texture: source, grade: variant.grade }); }
      catch (error) {
        console.warn('Используем исходную текстуру без коррекции:', variant.name, error);
        texture = source;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }));
    textures = loadedWood.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      console.warn('Не удалось загрузить текстуру дерева:', variants[index].name, result.reason);
      return null;
    });
    const baseWood = textures[1] || textures.find(Boolean);
    if (baseWood) {
      const floorTexture = baseWood.clone();
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
      ], baseWood);
    }
    for (const [target, index] of Object.entries(selected)) setVariant(target, index);
    await wallpaperReady;
  }

  return { initialize, setVariant };
}
