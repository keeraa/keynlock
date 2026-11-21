// Paint atlas and material ownership for a single landmark model.
import {acquireLandmarkTextures} from './landmark-textures.js';

export function createLandmarkMaterials(T) {
  const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.96,metalness:0,...extra});
  const paintedGlass=(color)=>new T.MeshPhysicalMaterial({
    color,roughness:.28,metalness:.1,clearcoat:.86,clearcoatRoughness:.11,
    side:T.DoubleSide,
  });
  const m={
    ivory:material('#eee0c2'),cream:material('#d6c3a4'),stone:material('#c0ac8b'),stoneDark:material('#8f816a'),
    plaster:material('#e2d2b4'),pale:material('#f5e9cf'),brick:material('#b98065'),
    roof:material('#a64d3c',{side:T.DoubleSide}),roofDeep:material('#653c3c',{side:T.DoubleSide}),
    roofTrim:material('#754739'),slateTrim:material('#566b73'),
    slate:material('#506873',{side:T.DoubleSide}),slateLight:material('#78909a',{side:T.DoubleSide}),
    copper:material('#689589',{metalness:.12,side:T.DoubleSide}),copperLight:material('#9bb9a2'),
    glass:paintedGlass('#d0e0df'),glassLight:paintedGlass('#f0f2e9'),
    gold:material('#c6a466',{metalness:.28}),
    wood:material('#593e30'),woodLight:material('#96765c'),iron:material('#39474b',{metalness:.24}),
    shadow:material('#493e35'),grass:material('#8da17c'),stoneStep:material('#d5c6a7'),
    door:material('#ffffff',{side:T.DoubleSide}),sill:material('#d9c09c'),
  };
  const textureLease=acquireLandmarkTextures(T);
  const paintedSurfaces={
    // One subdued gouache ashlar painting across the buildings' masonry.
    // The smooth clock dial stays on plaster, glass and sills keep theirs.
    ivory:'stone',cream:'stone',plaster:'stone',pale:'plaster',brick:'stone',
    stone:'stone',stoneDark:'stone',stoneStep:'stone',sill:'sill',
    roof:'roof',roofDeep:'roof',slate:'roof',slateLight:'roof',
    copper:'copper',copperLight:'copper',
    door:'door',glass:'glass',glassLight:'glass',
  };
  for(const [key,kind] of Object.entries(paintedSurfaces)){
    const mat=m[key];mat.map=textureLease.maps[kind]??null;
    // Verdigris is already colored; tile and stone tones come from pigments.
    if(kind==='copper')mat.color.set('#ffffff');
    mat.userData.landmarkTexture=kind;
    mat.needsUpdate=true;
  }
  for(const key of ['stone','stoneDark','stoneStep'])m[key].userData.landmarkSurface='architecturalStone';
  return {m,textureLease,paintedSurfaces};
}
