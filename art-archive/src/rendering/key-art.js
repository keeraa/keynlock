import * as THREE from '../../vendor/three.js';

// Approved Keynlock art direction. Keep these values stable when moving keys
// into a new room; only the preview scene applies this lighting preset.
export const KEY_ART=Object.freeze({
  paper:'gouache-parchment.webp',
  metalness:.33,roughness:.72,
  maxPixelRatio:1.8,exposure:1.32,shadowResolution:1024,
  skyColor:0xffe3ba,groundColor:0x829392,skyIntensity:2.4,
  keyColor:0xffefcc,keyIntensity:3.2,fillColor:0xaecbc6,fillIntensity:1.65,
  shadowOpacity:.19,
  outline:Object.freeze({radius:1.55,normalThreshold:.42,depthThreshold:.00036,
    opacity:.91,ink:'#332a23'}),
});

export function installKeyPreviewArt(renderer,scene) {
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,KEY_ART.maxPixelRatio));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=KEY_ART.exposure;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;

  scene.add(new THREE.HemisphereLight(KEY_ART.skyColor,KEY_ART.groundColor,KEY_ART.skyIntensity));
  const keyLight=new THREE.DirectionalLight(KEY_ART.keyColor,KEY_ART.keyIntensity);
  keyLight.position.set(-3,5,7);keyLight.castShadow=true;
  keyLight.shadow.mapSize.set(KEY_ART.shadowResolution,KEY_ART.shadowResolution);
  keyLight.shadow.camera.left=-5;keyLight.shadow.camera.right=5;
  keyLight.shadow.camera.top=5;keyLight.shadow.camera.bottom=-5;
  keyLight.shadow.bias=-.0004;keyLight.shadow.radius=3;
  scene.add(keyLight);
  const fill=new THREE.DirectionalLight(KEY_ART.fillColor,KEY_ART.fillIntensity);
  fill.position.set(4,-4,3);scene.add(fill);
  const shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(20,20),
    new THREE.ShadowMaterial({opacity:KEY_ART.shadowOpacity,transparent:true}));
  shadowPlane.position.z=-.47;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
  return shadowPlane;
}
