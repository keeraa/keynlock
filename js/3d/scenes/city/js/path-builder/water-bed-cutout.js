// The water is a single textured plane below the land. On coarse adaptive
// terrain tiles the ground triangles can cut across the water mask and hide
// entire stretches of river. Clip those pixels using the EXACT same union
// mask as the water plane; bridges/buildings retain normal depth testing.
// A half-coverage coastline pixel belongs to the river. Ground and surface
// must agree at this exact threshold or the scene background shows as broad
// white strips when a soft water alpha is drawn over discarded ground.
export const WATER_CUTOUT_THRESHOLD=.5;

export function attachWaterbedCutout(material,waterMaskTexture){
  const previousCompile=material.onBeforeCompile;
  const previousCacheKey=material.customProgramCacheKey?.()||'';
  material.onBeforeCompile=shader=>{
    previousCompile?.call(material,shader);
    shader.uniforms.uKeynlockWaterMask={value:waterMaskTexture};
    if(!shader.fragmentShader.includes('#include <map_fragment>'))return;
    shader.fragmentShader=`uniform sampler2D uKeynlockWaterMask;\n${shader.fragmentShader}`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>\nif (texture2D(uKeynlockWaterMask, vMapUv).a > ${WATER_CUTOUT_THRESHOLD}) discard;`);
  };
  material.customProgramCacheKey=()=>`keynlock-waterbed-cutout-v2:${previousCacheKey}`;
  return material;
}

export function attachOpaqueWaterSurface(material){
  const previousCompile=material.onBeforeCompile;
  const previousCacheKey=material.customProgramCacheKey?.()||'';
  material.onBeforeCompile=shader=>{
    previousCompile?.call(material,shader);
    if(!shader.fragmentShader.includes('#include <map_fragment>'))return;
    // Water is already below the excavated soil. Once the soil is clipped,
    // its semi-transparent pixel must become a SOLID water pixel; otherwise
    // the bright sky color leaks through the whole feathered shoreline.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>\ndiffuseColor.a = texture2D(map, vMapUv).a > ${WATER_CUTOUT_THRESHOLD} ? 1.0 : 0.0;`);
  };
  material.alphaTest=.5;
  material.transparent=false;
  material.depthWrite=true;
  material.customProgramCacheKey=()=>`keynlock-opaque-water-v1:${previousCacheKey}`;
  return material;
}
