/**
 * The Atelier's four original gouache finishes. Vite turns these module-relative
 * URLs into hashed files in the build; the wood style loads them like any other
 * texture. (They used to be inlined into the JavaScript as base64, which made
 * the Lair's main bundle 1.2 MB larger and parsed on every load, while the
 * same files were also emitted separately.)
 */
export const atelierWoodSources = [
  new URL('./assets/textures/wood-oak-gouache-v2.webp', import.meta.url).href,
  new URL('./assets/textures/wood-walnut-gouache-v2.webp', import.meta.url).href,
  new URL('./assets/textures/wood-ash-gouache-v2.webp', import.meta.url).href,
];

export const atelierWallpaperSource = new URL('./assets/textures/atelier-wallpaper-gouache.webp', import.meta.url).href;
