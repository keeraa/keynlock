import { createSunbeams } from '../sunbeams.js';
import { createBackgroundEffects } from '../background-effects.js';

/** The exact colour and illumination recipe used by the original laboratory.
 * It can be applied to any Three.js r187 scene, including KEYNLOCK Lair.
 */
export const ALCHEMY_LOOK = Object.freeze({
  renderer: Object.freeze({pixelRatioCap: 1.65, exposure: 1.4, shadowMapSize: 2048}),
  scene: Object.freeze({fogColor: 0x152122, fogDensity: .024}),
  hemisphere: Object.freeze({sky: 0x97c5cb, ground: 0x2e1e17, intensity: 2.05}),
  key: Object.freeze({color: 0xffe6ba, intensity: 2.3, normalBias: .026,
    directions: Object.freeze({left: [-7.5, 9.3, 5.4], top: [.4, 13.5, 1], right: [7.5, 9.3, 5.4]})}),
  coldRim: Object.freeze({color: 0x63b4bd, intensity: 52, distance: 15, decay: 2, position: [6, 4.8, -2.7]}),
  amberRim: Object.freeze({color: 0xf5a95b, intensity: 40, distance: 14, decay: 2, position: [-6, 3.9, -2.4]}),
  background: Object.freeze({hemisphereSky: 0xb9d0c8, hemisphereGround: 0x473e34,
    hemisphereIntensity: 2.55, keyColor: 0xffdcac, keyIntensity: 1.8, blur: true}),
  filters: Object.freeze({drawing:true,toon:false,toonStrength:80,toonSteps:4,
    outline:true,outlineSaturation:100,outlineWidth:1,painted:true,
    frame:'steel',accents:'brass',brushExpression:95,cartoonMaterial:90,brushDetail:0}),
  defaults: Object.freeze({direction: 'right', strength: 100, sunbeamLeft: false, sunbeamRight: true}),
});

export function applyAlchemyRendererLook(THREE, renderer, profile = ALCHEMY_LOOK) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = profile.renderer.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
}

export function createAlchemyLightingRig(THREE, {scene, backgroundScene = null, renderer = null,
  profile = ALCHEMY_LOOK, invalidateBackground = () => {}}) {
  const hemi = new THREE.HemisphereLight(profile.hemisphere.sky, profile.hemisphere.ground, profile.hemisphere.intensity);
  const key = new THREE.DirectionalLight(profile.key.color, profile.key.intensity);
  key.position.set(...profile.key.directions[profile.defaults.direction]);
  key.castShadow = true;
  key.shadow.mapSize.set(profile.renderer.shadowMapSize, profile.renderer.shadowMapSize);
  Object.assign(key.shadow.camera, {left:-10,right:10,top:10,bottom:-8});
  key.shadow.normalBias = profile.key.normalBias;
  const cold = new THREE.PointLight(profile.coldRim.color, profile.coldRim.intensity,
    profile.coldRim.distance, profile.coldRim.decay);
  cold.position.set(...profile.coldRim.position);
  const amber = new THREE.PointLight(profile.amberRim.color, profile.amberRim.intensity,
    profile.amberRim.distance, profile.amberRim.decay);
  amber.position.set(...profile.amberRim.position);
  scene.add(hemi,key,cold,amber);

  let backdropHemi = null;
  let backdropKey = null;
  if (backgroundScene) {
    backdropHemi = new THREE.HemisphereLight(profile.background.hemisphereSky,
      profile.background.hemisphereGround, profile.background.hemisphereIntensity);
    backdropKey = new THREE.DirectionalLight(profile.background.keyColor,profile.background.keyIntensity);
    backdropKey.position.copy(key.position);
    backgroundScene.add(backdropHemi,backdropKey);
  }
  let direction = profile.defaults.direction;
  let strength = profile.defaults.strength;
  function invalidate() {
    invalidateBackground();
    key.shadow.needsUpdate = true;
    if (renderer?.shadowMap) renderer.shadowMap.needsUpdate = true;
  }
  function setDirection(next) {
    const position = profile.key.directions[next];
    if (!position) return false;
    direction = next;
    key.position.set(...position);
    backdropKey?.position.copy(key.position);
    invalidate();
    return true;
  }
  function setStrength(value) {
    if (!Number.isFinite(value)) return false;
    strength = Math.min(160,Math.max(20,value));
    key.intensity = profile.key.intensity * strength / 100;
    if (backdropKey) backdropKey.intensity = profile.background.keyIntensity * strength / 100;
    invalidate();
    return true;
  }
  return {keyLight:key, coldRim:cold, amberRim:amber, backgroundLight:backdropKey,
    setDirection,setStrength,getState:()=>({direction,strength}),
    dispose() {scene.remove(hemi,key,cold,amber);if(backgroundScene)backgroundScene.remove(backdropHemi,backdropKey);}};
}

/** Optional filters for the standalone lab. Consumers may use just the rig. */
export function createAlchemyLook(THREE,{scene,backgroundScene,renderer,profile=ALCHEMY_LOOK}) {
  const backgroundEffects = createBackgroundEffects(THREE,renderer,backgroundScene);
  const lighting = createAlchemyLightingRig(THREE,{scene,backgroundScene,renderer,profile,
    invalidateBackground:()=>backgroundEffects.invalidateRoom()});
  const sunbeams = createSunbeams(THREE);
  sunbeams.setVisible('left',profile.defaults.sunbeamLeft);
  sunbeams.setVisible('right',profile.defaults.sunbeamRight);
  backgroundEffects.setBlur(profile.background.blur);
  return {...lighting, sunbeams, backgroundEffects};
}
