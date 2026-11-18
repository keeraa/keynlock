import * as THREE from '../vendor/three.js';
import { METALS, KEY_TEMPLATES, RUST_TEXTURE, keyAssetUrl } from './key-data.js';
import { MAX_KEY_MARKS, markPigment, keyMarkings } from './key-markings.js';
import { KEY_ART } from './key-art.js';

const textureCache=new Map();
export const matCache=new Map();
const loader=new THREE.TextureLoader();

function loadPaintedTexture(file) {
  if(typeof document==='undefined') return null;
  if(textureCache.has(file)) return textureCache.get(file);
  const texture=loader.load(keyAssetUrl(file));
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=file===RUST_TEXTURE?THREE.RepeatWrapping:THREE.MirroredRepeatWrapping;
  texture.repeat.set(file===RUST_TEXTURE?1:.72,file===RUST_TEXTURE?1:.72);
  texture.anisotropy=4;
  textureCache.set(file,texture);
  return texture;
}

function rustPlacement(templateIndex) {
  return {shiftX:(.173+templateIndex*.317)%1,shiftY:(.391+templateIndex*.619)%1,
    angle:.43+templateIndex*1.127};
}

export function getMetalMaterial(id,rustAmount=0,templateIndex=0,dirtAmount=0,cache=matCache,design=null) {
  const strength=Math.max(0,Math.min(200,rustAmount))/100;
  const grime=Math.max(0,Math.min(100,dirtAmount))/100;
  const placement=rustPlacement(templateIndex);
  const marks=design?keyMarkings(KEY_TEMPLATES[templateIndex],design):[];
  const stampLocations=Array.from({length:MAX_KEY_MARKS},(_,index)=>{
    const mark=marks[index];
    return new THREE.Vector4(mark?.x??0,mark?.y??0,mark?.rx??0,mark?.ry??0);
  });
  if(cache.has(id)) {
    const material=cache.get(id);
    material.userData.dirtUniform.value=grime;
    material.userData.dirtSeedUniform.value=templateIndex*11.37+3.71;
    material.userData.markCountUniform.value=marks.length;
    material.userData.markLocationsUniform.value=stampLocations;
    material.userData.markTintUniform.value.set(markPigment(id));
    material.userData.markDepthUniform.value=(design?.thickness??12)/100;
    if(material.userData.rustUniform) {
      material.userData.rustUniform.value=strength;
      material.userData.rustShiftUniform.value.set(placement.shiftX,placement.shiftY);
      material.userData.rustAngleUniform.value=placement.angle;
    }
    return material;
  }
  const definition=METALS.find(m=>m.id===id)||METALS[0];
  const material=new THREE.MeshStandardMaterial({map:loadPaintedTexture(definition.file),color:definition.tint,
    metalness:KEY_ART.metalness,roughness:KEY_ART.roughness,side:THREE.FrontSide});
  const dirtUniform={value:grime},dirtSeedUniform={value:templateIndex*11.37+3.71};
  material.userData.dirtUniform=dirtUniform;
  material.userData.dirtSeedUniform=dirtSeedUniform;
  const markCountUniform={value:marks.length},markLocationsUniform={value:stampLocations};
  const markTintUniform={value:new THREE.Color(markPigment(id))};
  const markDepthUniform={value:(design?.thickness??12)/100};
  material.userData.markCountUniform=markCountUniform;
  material.userData.markLocationsUniform=markLocationsUniform;
  material.userData.markTintUniform=markTintUniform;
  material.userData.markDepthUniform=markDepthUniform;
  const rustTexture=loadPaintedTexture(RUST_TEXTURE);
  if(rustTexture) {
    const rustUniform={value:strength};
    const rustShiftUniform={value:new THREE.Vector2(placement.shiftX,placement.shiftY)};
    const rustAngleUniform={value:placement.angle};
    material.userData.rustUniform=rustUniform;
    material.userData.rustShiftUniform=rustShiftUniform;
    material.userData.rustAngleUniform=rustAngleUniform;
    material.onBeforeCompile=shader=>{
      shader.uniforms.uPaintedRust={value:rustTexture};
      shader.uniforms.uRustAmount=rustUniform;
      shader.uniforms.uRustShift=rustShiftUniform;
      shader.uniforms.uRustAngle=rustAngleUniform;
      shader.uniforms.uDirtAmount=dirtUniform;
      shader.uniforms.uDirtSeed=dirtSeedUniform;
      shader.uniforms.uMarkCount=markCountUniform;
      shader.uniforms.uKeyMarks=markLocationsUniform;
      shader.uniforms.uMarkTint=markTintUniform;
      shader.uniforms.uMarkDepth=markDepthUniform;
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nvarying vec3 vKeySurface;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvKeySurface = position;');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>',`#include <common>
          varying vec3 vKeySurface;
          uniform float uDirtAmount;
          uniform float uDirtSeed;
          uniform float uMarkCount;
          uniform float uMarkDepth;
          uniform vec3 uMarkTint;
          uniform vec4 uKeyMarks[${MAX_KEY_MARKS}];
          float dirtHash(vec2 p) {return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float dirtNoise(vec2 p) {
            vec2 cell=floor(p),f=fract(p);
            f=f*f*(3.0-2.0*f);
            float a=dirtHash(cell),b=dirtHash(cell+vec2(1.0,0.0));
            float c=dirtHash(cell+vec2(0.0,1.0)),d=dirtHash(cell+vec2(1.0,1.0));
            return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
          }`)
        .replace('#include <map_pars_fragment>',
          '#include <map_pars_fragment>\nuniform sampler2D uPaintedRust;\nuniform float uRustAmount;\nuniform vec2 uRustShift;\nuniform float uRustAngle;')
        .replace('#include <map_fragment>',
          `#include <map_fragment>
          float rustC = cos(uRustAngle), rustS = sin(uRustAngle);
          vec2 rustUv = mat2(rustC, rustS, -rustS, rustC) * (vMapUv * vec2(1.13, 1.29)) + uRustShift;
          vec4 rustPigment = texture2D(uPaintedRust, rustUv);
          float rustCoverage = clamp(rustPigment.a * uRustAmount * 1.12, 0.0, 1.0);
          float rustDeepen = clamp(uRustAmount - 1.0, 0.0, 1.0);
          vec3 rustColor = mix(rustPigment.rgb, vec3(0.14, 0.055, 0.021), rustDeepen * 0.68);
          diffuseColor.rgb = mix(diffuseColor.rgb, rustColor, rustCoverage);
          // Filled gouache ovals are pigments IN the metal's BRDF. They use
          // the exact same lights, cast no floating planes and cost 0 polygons.
          float markCoverage=0.0;
          if(uMarkCount > 0.5 && uDirtAmount < .995 &&
             abs(vKeySurface.x+1.21)<.82 && abs(vKeySurface.y)<.87 &&
             (abs(vKeySurface.z) < .002 || abs(vKeySurface.z-uMarkDepth) < .002)) {
            float brush=(dirtNoise(vKeySurface.xy*71.3+vec2(5.9,2.2))-.5)*.14;
            for(int i=0;i<${MAX_KEY_MARKS};i++) {
              if(float(i)>=uMarkCount)break;
              vec4 stamp=uKeyMarks[i];
              vec2 delta=(vKeySurface.xy-stamp.xy)/stamp.zw;
              float edge=length(delta);
              markCoverage=max(markCoverage,1.0-smoothstep(.88+brush,1.03+brush,edge));
            }
          }
          diffuseColor.rgb=mix(diffuseColor.rgb,uMarkTint,markCoverage*.96);
          float dirtCoverage = 0.0;
          if(uDirtAmount > 0.001) {
            vec2 grainUv=vKeySurface.xy+vec2(uDirtSeed,uDirtSeed*.371);
            float broad=dirtNoise(grainUv*3.7);
            float speckles=dirtNoise(grainUv*18.9+vec2(2.1,7.6));
            float variation=broad*.74+speckles*.26;
            float threshold=mix(.94,-.16,clamp(uDirtAmount,0.0,1.0));
            dirtCoverage=smoothstep(threshold-.085,threshold+.085,variation);
            vec3 mud=mix(vec3(.15,.091,.049),vec3(.35,.257,.15),.28+speckles*.69);
            diffuseColor.rgb=mix(diffuseColor.rgb,mud,dirtCoverage);
          }`)
        .replace('#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .89, markCoverage);\nroughnessFactor = mix(roughnessFactor, 1.0, dirtCoverage);')
        .replace('#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, .08, markCoverage);\nmetalnessFactor *= (1.0 - 0.98 * dirtCoverage);');
    };
    material.customProgramCacheKey=()=> 'keynlock-gouache-stamps-rust-grime-v4';
  }
  cache.set(id,material);return material;
}
