/**
 * Keep the Atelier's four original gouache finishes in the application build.
 * The published room must not depend on separate texture file requests after
 * its controls have already appeared. Node-only tests use the files'
 * module-relative URLs; Vite resolves these imports to embedded WebP image data.
 */
const assets = typeof import.meta.glob === 'function'
  ? import.meta.glob('./assets/textures/*.webp', { eager: true, query: '?inline', import: 'default' })
  : {};

function source(filename, fallback) {
  return assets[`./assets/textures/${filename}`] || fallback;
}

export const atelierWoodSources = [
  source('wood-oak-gouache-v2.webp', new URL('./assets/textures/wood-oak-gouache-v2.webp', import.meta.url).href),
  source('wood-walnut-gouache-v2.webp', new URL('./assets/textures/wood-walnut-gouache-v2.webp', import.meta.url).href),
  source('wood-ash-gouache-v2.webp', new URL('./assets/textures/wood-ash-gouache-v2.webp', import.meta.url).href),
];

export const atelierWallpaperSource = source('atelier-wallpaper-gouache.webp',
  new URL('./assets/textures/atelier-wallpaper-gouache.webp', import.meta.url).href);
