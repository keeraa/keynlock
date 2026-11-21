import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {HOUSE_TEXTURE_DEFINITIONS,HOUSE_FALLBACK_TEXTURES,HOUSE_MOSS_TEXTURE} from '../modules/house-builder/core/house-texture-assets.js';
import {LANDMARK_TEXTURE_ASSETS} from '../js/landmarks/landmark-textures.js';
import {ACTIVE_GOUACHE_FILES,GOUACHE_ASSETS,gouacheAssetUrl,gouacheAssetUrlByFile} from '../modules/keynlock-materials/index.js';
import {GROUND_PALETTES} from '../modules/keynlock-materials/ground-palettes.js';

const files=new Set([...HOUSE_TEXTURE_DEFINITIONS.map(([,file])=>file),
  ...HOUSE_FALLBACK_TEXTURES.map(([,file])=>file),HOUSE_MOSS_TEXTURE,
  ...Object.values(LANDMARK_TEXTURE_ASSETS)]);
assert.equal(files.size,12,'Only active painted textures belong in the public build');
assert.equal(ACTIVE_GOUACHE_FILES.length,14,'One registry owns 12 building and 2 ground textures');
assert.equal(new Set(ACTIVE_GOUACHE_FILES).size,14,'Registry must not duplicate copies of one artwork');
for(const folder of ['ground','house-textures']){
  const actual=(await readdir(new URL(`../assets/${folder}/`,import.meta.url)))
    .filter(name=>name.endsWith('.webp')).sort();
  const approved=ACTIVE_GOUACHE_FILES.filter(name=>name.startsWith(`${folder}/`))
    .map(name=>name.slice(folder.length+1)).sort();
  assert.deepEqual(actual,approved,
    `All working WebP textures in ${folder} must be registered and used`);
}
assert.deepEqual(new Set(ACTIVE_GOUACHE_FILES),new Set([
  ...[GOUACHE_ASSETS.ground.earth,GOUACHE_ASSETS.ground.grass].map(name=>`ground/${name}`),
  ...[...files].map(name=>`house-textures/${name}`),
]));
assert.equal(Object.keys(GROUND_PALETTES).length,7);
assert(!files.has('landmark-copper-gouache.png'),
  'Uncompressed copper roof must remain a source-only historical asset');
for(const name of ACTIVE_GOUACHE_FILES){
  assert((await stat(new URL(`../assets/${name}`,import.meta.url))).size>1000,`Missing shared material ${name}`);
}
for(const name of files){
  const target=new URL(`../assets/house-textures/${name}`,import.meta.url);
  assert((await stat(target)).size>1000,`Missing active asset ${name}`);
}
assert.equal(gouacheAssetUrlByFile('house',LANDMARK_TEXTURE_ASSETS.stone),
  gouacheAssetUrl('house','landmarkStone'));
assert.throws(()=>gouacheAssetUrl('house','not-found'),/Неизвестная/);
const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
assert(build.includes('ACTIVE_GOUACHE_FILES')&&!build.includes("await cp(resolve(root,'assets/house-textures'),"),
  'Static deployment must copy the active asset manifest, not the texture archive');
console.log(`Shared KEYNLOCK material manifest: ${ACTIVE_GOUACHE_FILES.length} active images, source paintings preserved`);
