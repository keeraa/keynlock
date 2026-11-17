/**
 * Keep the Atelier's four original gouache finishes in the application build.
 * The published room must not depend on separate texture file requests after
 * its controls have already appeared. Node-only geometry tests use the normal
 * public paths; Vite resolves these imports to embedded WebP image data.
 */
const assets = typeof import.meta.glob === 'function'
  ? import.meta.glob('../public/textures/*.webp', { eager: true, query: '?inline', import: 'default' })
  : {};

function source(filename, fallback) {
  return assets[`../public/textures/${filename}`] || fallback;
}

export const atelierWoodSources = [
  source('wood-oak-gouache-v2.webp', '/stations/atelier/textures/wood-oak-gouache-v2.webp'),
  source('wood-walnut-gouache-v2.webp', '/stations/atelier/textures/wood-walnut-gouache-v2.webp'),
  source('wood-ash-gouache-v2.webp', '/stations/atelier/textures/wood-ash-gouache-v2.webp'),
];

export const atelierWallpaperSource = source('atelier-wallpaper-gouache.webp',
  '/stations/atelier/textures/atelier-wallpaper-gouache.webp');
