/** Set up the static viewport, camera controls, lighting and receiving table. */
export function createLockStage({THREE,OrbitControls,canvas,pixelRatio}) {
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(39,1,.08,100);
  camera.position.set(5.4,3.2,7.7);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,
    powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.23;
  renderer.setPixelRatio(Math.min(pixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const controls=new OrbitControls(camera,canvas);
  controls.target.set(.28,.02,0);
  controls.enableDamping=true;
  controls.dampingFactor=.065;
  controls.autoRotate=false;
  controls.minDistance=4.6;
  controls.maxDistance=13.5;
  controls.minPolarAngle=.15;
  controls.maxPolarAngle=Math.PI-.15;
  // Command + left drag pans in r187; right-drag pans as usual.
  controls.enablePan=true;
  controls.panSpeed=.85;

  scene.add(new THREE.HemisphereLight(0xb4d2dc,0x25313a,1.65));
  const keyLight=new THREE.DirectionalLight(0xffe5c1,2.5);
  keyLight.position.set(-3,5,6);
  keyLight.castShadow=true;
  keyLight.shadow.mapSize.set(1024,1024);
  keyLight.shadow.camera.left=-7;
  keyLight.shadow.camera.right=7;
  keyLight.shadow.camera.top=7;
  keyLight.shadow.camera.bottom=-7;
  keyLight.shadow.bias=-.0003;
  scene.add(keyLight);
  const fill=new THREE.DirectionalLight(0x91c1dc,1.9);
  fill.position.set(4,1,-5);
  scene.add(fill);
  const edge=new THREE.PointLight(0xf7a35b,45,14,2);
  edge.position.set(2.4,-.4,3.9);
  scene.add(edge);

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),
    new THREE.ShadowMaterial({opacity:.15}));
  floor.rotation.x=-Math.PI/2;
  floor.position.y=-2.13;
  floor.receiveShadow=true;
  scene.add(floor);
  const landingSurface=new THREE.Mesh(new THREE.PlaneGeometry(200,200),
    new THREE.MeshStandardMaterial({color:0x12212a,roughness:.94,metalness:.06}));
  landingSurface.rotation.x=-Math.PI/2;
  landingSurface.position.y=-2.137;
  landingSurface.receiveShadow=true;
  scene.add(landingSurface);
  return {scene,camera,renderer,controls};
}
