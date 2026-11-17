import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {HOUSE_TEXTURE_DEFINITIONS,HOUSE_FALLBACK_TEXTURES,HOUSE_MOSS_TEXTURE} from '../modules/house-builder/core/house-texture-assets.js';
import {LANDMARK_TEXTURE_ASSETS} from '../js/landmarks/landmark-textures.js';

const files=new Set([...HOUSE_TEXTURE_DEFINITIONS.map(([,file])=>file),
  ...HOUSE_FALLBACK_TEXTURES.map(([,file])=>file),HOUSE_MOSS_TEXTURE,
  ...Object.values(LANDMARK_TEXTURE_ASSETS)]);
assert.equal(files.size,12,'Only active painted textures belong in the public build');
assert(!files.has('landmark-copper-gouache.png'),
  'Uncompressed copper roof must remain a source-only historical asset');
for(const name of files){
  const target=new URL(`../assets/house-textures/${name}`,import.meta.url);
  assert((await stat(target)).size>1000,`Missing active asset ${name}`);
}
const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
assert(build.includes('productionTextures')&&!build.includes("await cp(resolve(root,'assets/house-textures'),"),
  'Static deployment must copy the active asset manifest, not the texture archive');
console.log(`Asset manifest: ${files.size} active images, source paintings preserved`);
