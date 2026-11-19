import { makePaintTexture } from './art.js?v=17';
import { HALL_SURFACE_URLS } from './hall-surface-textures.js?v=23';
import { ARCHIVE_FLOOR_TEXTURE_URL } from './archive-floor-texture.js';

// Optional Canvas renderer retains its original paintings while images load.
export function createFallbackSurfaces(ctx) {
  const surfaces = {
    wood: ctx.createPattern(makePaintTexture('wood', 45).image, 'repeat'),
    plaster: ctx.createPattern(makePaintTexture('plaster', 32).image, 'repeat'),
    carpet: ctx.createPattern(makePaintTexture('rug', 177).image, 'repeat'),
  };
  surfaces.floor = surfaces.wood;
  surfaces.ceiling = surfaces.wood;
  for (const [name, url] of [
    ['floor', ARCHIVE_FLOOR_TEXTURE_URL],
    ['plaster', HALL_SURFACE_URLS.wall],
    ['ceiling', HALL_SURFACE_URLS.ceiling],
    ['carpet', HALL_SURFACE_URLS.carpet],
  ]) {
    const image = new Image();
    image.onload = () => { surfaces[name] = ctx.createPattern(image, 'repeat') || surfaces[name]; };
    image.src = url;
  }
  return surfaces;
}
