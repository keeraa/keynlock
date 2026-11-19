import * as THREE from '../vendor/three.js';
import { METALS, RUST_TEXTURE, keyAssetUrl } from './key-data.js';
import { KEY_ART } from './key-art.js';

const textureCache=new Map();
const texturePromises=new Map();
export const matCache=new Map();
const loader=new THREE.TextureLoader();

function loadPaintedTexture(file) {
  if(typeof document==='undefined') return null;
  if(textureCache.has(file)) return textureCache.get(file);
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const texture=loader.load(keyAssetUrl(file),()=>resolveReady(texture),undefined,rejectReady);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=file===RUST_TEXTURE?THREE.RepeatWrapping:THREE.MirroredRepeatWrapping;
  texture.repeat.set(file===RUST_TEXTURE?1:.72,file===RUST_TEXTURE?1:.72);
  texture.anisotropy=4;
  textureCache.set(file,texture);
  texturePromises.set(file,ready);
  return texture;
}

// The archive awaits this once before placing hundreds of keys. Lazy editor
// loads and explicit preloads share the same GPU textures and in-flight jobs.
export function preloadKeyTextures() {
  if(typeof document==='undefined')return Promise.resolve([]);
  const files=[...new Set([...METALS.map(m=>m.file),RUST_TEXTURE])];
  return Promise.all(files.map(file=>{
    loadPaintedTexture(file);
    return texturePromises.get(file);
  }));
}

function rustPlacement(templateIndex) {
  return {shiftX:(.173+templateIndex*.317)%1,shiftY:(.391+templateIndex*.619)%1,
    angle:.43+templateIndex*1.127};
}

export function getMetalMaterial(id,rustAmount=0,templateIndex=0,dirtAmount=0,cache=matCache) {
  const strength=Math.max(0,Math.min(200,rustAmount))/100;
  const grime=Math.max(0,Math.min(100,dirtAmount))/100;
  const placement=rustPlacement(templateIndex);
  if(cache.has(id)) {
    const material=cache.get(id);
    material.userData.dirtUniform.value=grime;
    material.userData.dirtSeedUniform.value=templateIndex*11.37+3.71;
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
  const rustTexture=loadPaintedTexture(RUST_TEXTURE);
  if(rustTexture) {
    const rustUniform={value:strength};
    const rustShiftUniform={value:new THREE.Vector2(placement.shiftX,placement.shiftY)};
    const rustAngleUniform={value:placement.angle};
    // Rust soak animation: 0 keeps all rust, above 1 every patch has flaked off.
    const rustErodeUniform={value:-.1};
    material.userData.rustErodeUniform=rustErodeUniform;
    material.userData.rustUniform=rustUniform;
    material.userData.rustShiftUniform=rustShiftUniform;
    material.userData.rustAngleUniform=rustAngleUniform;
    material.onBeforeCompile=shader=>{
      shader.uniforms.uPaintedRust={value:rustTexture};
      shader.uniforms.uRustAmount=rustUniform;
      shader.uniforms.uRustShift=rustShiftUniform;
      shader.uniforms.uRustAngle=rustAngleUniform;
      shader.uniforms.uRustErode=rustErodeUniform;
      shader.uniforms.uDirtAmount=dirtUniform;
      shader.uniforms.uDirtSeed=dirtSeedUniform;
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>',`#include <common>
          varying vec3 vKeySurface;
          varying vec3 vInstanceKeyPaint;
          #ifdef USE_INSTANCING
          attribute vec3 instanceKeyPaint;
          #endif`)
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vKeySurface = position;
          #ifdef USE_INSTANCING
          vInstanceKeyPaint = instanceKeyPaint;
          #else
          vInstanceKeyPaint = vec3(-1.0);
          #endif`);
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>',`#include <common>
          varying vec3 vKeySurface;
          varying vec3 vInstanceKeyPaint;
          uniform float uDirtAmount;
          uniform float uDirtSeed;
          float dirtHash(vec2 p) {return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float dirtNoise(vec2 p) {
            vec2 cell=floor(p),f=fract(p);
            f=f*f*(3.0-2.0*f);
            float a=dirtHash(cell),b=dirtHash(cell+vec2(1.0,0.0));
            float c=dirtHash(cell+vec2(0.0,1.0)),d=dirtHash(cell+vec2(1.0,1.0));
            return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
          }`)
        .replace('#include <map_pars_fragment>',
          '#include <map_pars_fragment>\nuniform sampler2D uPaintedRust;\nuniform float uRustAmount;\nuniform vec2 uRustShift;\nuniform float uRustAngle;\nuniform float uRustErode;')
        .replace('#include <map_fragment>',
          `#include <map_fragment>
          float keyRust = vInstanceKeyPaint.x < 0.0 ? uRustAmount : vInstanceKeyPaint.x;
          float keyDirt = vInstanceKeyPaint.y < 0.0 ? uDirtAmount : vInstanceKeyPaint.y;
          float keySeed = max(0.0,vInstanceKeyPaint.z);
          float rustAngle = uRustAngle + keySeed*.127;
          float rustC = cos(rustAngle), rustS = sin(rustAngle);
          vec2 rustUv = mat2(rustC, rustS, -rustS, rustC) * (vMapUv * vec2(1.13, 1.29))
            + uRustShift + vec2(keySeed*.031,keySeed*.071);
          vec4 rustPigment = texture2D(uPaintedRust, rustUv);
          float rustCoverage = clamp(rustPigment.a * keyRust * 1.12, 0.0, 1.0);
          // Flaking: patches of rust drop away one after another.
          float rustFlake = dirtNoise(vKeySurface.xy*5.3+vec2(1.7,4.1))*.7+dirtNoise(vKeySurface.xy*13.1+vec2(8.3,2.9))*.3;
          rustCoverage *= smoothstep(uRustErode-.05, uRustErode+.05, rustFlake);
          float rustDeepen = clamp(keyRust - 1.0, 0.0, 1.0);
          vec3 rustColor = mix(rustPigment.rgb, vec3(0.14, 0.055, 0.021), rustDeepen * 0.68);
          diffuseColor.rgb = mix(diffuseColor.rgb, rustColor, rustCoverage);
          float dirtCoverage = 0.0;
          if(keyDirt > 0.001) {
            vec2 grainUv=vKeySurface.xy+vec2(uDirtSeed+keySeed,uDirtSeed*.371+keySeed*.13);
            float broad=dirtNoise(grainUv*3.7);
            float speckles=dirtNoise(grainUv*18.9+vec2(2.1,7.6));
            float variation=broad*.74+speckles*.26;
            float threshold=mix(.94,-.16,clamp(keyDirt,0.0,1.0));
            dirtCoverage=smoothstep(threshold-.085,threshold+.085,variation);
            vec3 mud=mix(vec3(.15,.091,.049),vec3(.35,.257,.15),.28+speckles*.69);
            diffuseColor.rgb=mix(diffuseColor.rgb,mud,dirtCoverage);
          }`)
        .replace('#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 1.0, dirtCoverage);')
        .replace('#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\nmetalnessFactor *= (1.0 - 0.98 * dirtCoverage);');
    };
    material.customProgramCacheKey=()=> 'keynlock-gouache-rust-grime-instancing-v7';
  }
  cache.set(id,material);return material;
}
