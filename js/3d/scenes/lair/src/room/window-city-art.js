// @ts-check
import * as THREE from 'three';

const sky = new URL('./assets/window-city/sky-canal.jpg', import.meta.url);
const middle = new URL('./assets/window-city/middle.webp', import.meta.url);
const near = new URL('./assets/window-city/near.webp', import.meta.url);

/** Raster layers for the arched window. The two town layers are baked from
 * KEYNLOCK's own house and landmark models with the city's gouache materials. */
export function loadCityWindowTextures() {
  const loader = new THREE.TextureLoader();
  const load = (/** @type {URL} */ url) => {
    const texture = loader.load(url.href);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  // The same painting provides two crops. The water sits horizontally in
  // world space so it foreshortens as the camera changes position.
  const skyTexture = load(sky);
  const water = skyTexture.clone();
  skyTexture.offset.y = .46;
  skyTexture.repeat.y = .54;
  water.offset.y = .024;
  water.repeat.y = .31;
  return { sky: skyTexture, water, middle: load(middle), near: load(near) };
}
