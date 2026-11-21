// One versioned asset registry for KEYNLOCK's approved painted materials.
// Scene-specific editors, portable model modules and the build all import it.
export const GOUACHE_ASSETS=Object.freeze({
  ground:Object.freeze({
    earth:'keynlock-earth-gouache-v1.webp',
    grass:'keynlock-grass-brush-v1.webp',
  }),
  house:Object.freeze({
    plaster:'gouache-plaster.webp',
    roof:'gouache-roof-tiles-dense-v3.webp',
    damage:'gouache-plaster-chipped-v3.webp',
    fallbackDamage:'gouache-plaster-chipped.webp',
    shutter:'gouache-shutters-oak-louver-v5.webp',
    door:'gouache-entry-door-carved-v1.webp',
    glass:'gouache-window-glass-v2.webp',
    sill:'gouache-window-sill-v2.webp',
    stoneBand:'gouache-stone-band.webp',
    landmarkStone:'gouache-landmark-stone-v1.webp',
    moss:'gouache-landmark-moss-v1.webp',
    copper:'landmark-copper-gouache.webp',
  }),
});

const H=GOUACHE_ASSETS.house;
export const HOUSE_TEXTURE_DEFINITIONS=Object.freeze([
  ['plaster',H.plaster,1.8],['roof',H.roof,1],['damage',H.damage,1],
  ['shutter',H.shutter,1],['door',H.door,1],['glass',H.glass,1],
  ['sill',H.sill,1],['stoneBand',H.stoneBand,[3,1]],
]);
export const HOUSE_FALLBACK_TEXTURES=Object.freeze([
  ['plaster',H.plaster],['roof',H.roof],['damage',H.fallbackDamage],['door',H.door],
]);
export const HOUSE_MOSS_TEXTURE=H.moss;
export const LANDMARK_TEXTURE_ASSETS=Object.freeze({
  plaster:H.plaster,stone:H.landmarkStone,moss:H.moss,roof:H.roof,
  door:H.door,glass:H.glass,sill:H.sill,copper:H.copper,
});

export const ACTIVE_GOUACHE_FILES=Object.freeze([
  ...Object.values(GOUACHE_ASSETS.ground).map(file=>`ground/${file}`),
  ...Object.values(GOUACHE_ASSETS.house).map(file=>`house-textures/${file}`),
]);

export function gouacheAssetUrl(group,key){
  const folder=group==='ground'?'ground':group==='house'?'house-textures':null;
  const filename=GOUACHE_ASSETS[group]?.[key];
  if(!folder||!filename)throw new Error(`Неизвестная гуашевая текстура: ${group}/${key}`);
  return new URL(`../../assets/${folder}/${filename}`,import.meta.url).href;
}

export function gouacheAssetUrlByFile(group,filename){
  const key=Object.keys(GOUACHE_ASSETS[group]||{}).find(key=>GOUACHE_ASSETS[group][key]===filename);
  if(!key)throw new Error(`Неизвестная гуашевая текстура: ${group}/${filename}`);
  return gouacheAssetUrl(group,key);
}
