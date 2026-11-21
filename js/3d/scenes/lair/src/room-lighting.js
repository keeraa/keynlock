// @ts-check
/** Warm side lighting with short, nearly vertical object shadows. */
export function addRoomLighting({ THREE, scene }) {
  scene.add(new THREE.HemisphereLight('#ffe5bb', '#36453f', 2.0));
  scene.add(new THREE.AmbientLight('#d4bb9b', .36));

  // The angled key light provides the gouache room's original warm modelling.
  // Its old shadow map stretched easels and tall props many metres over the
  // salon wall, window and floor, even after ceiling beams stopped casting.
  const sideSun = new THREE.DirectionalLight('#ffdbac', 2.75);
  sideSun.name = 'lair-warm-key-light';
  sideSun.position.set(-3.5, 15.7, 6.4);
  sideSun.castShadow = false;
  scene.add(sideSun);

  // An almost vertical, softer light keeps furniture contact shadows without
  // projecting those long diagonal bars over the paintings.
  const contactSun = new THREE.DirectionalLight('#ffe2c0', .55);
  contactSun.name = 'lair-overhead-shadow-light';
  contactSun.position.set(0, 28, 10.3);
  contactSun.target.position.set(0, 0, 10.3);
  contactSun.castShadow = true;
  contactSun.shadow.mapSize.set(2048, 2048);
  contactSun.shadow.camera.near = .4;
  contactSun.shadow.camera.far = 50;
  contactSun.shadow.camera.left = -12;
  contactSun.shadow.camera.right = 12;
  contactSun.shadow.camera.top = 20;
  contactSun.shadow.camera.bottom = -20;
  contactSun.shadow.bias = -.00022;
  contactSun.shadow.normalBias = .02;
  scene.add(contactSun, contactSun.target);

  const windowLight = new THREE.PointLight('#e9c090', 25, 11, 2);
  windowLight.position.set(-.3, 4.55, -4.8);
  scene.add(windowLight);
  const leftLight = new THREE.PointLight('#ffd5aa', 12, 8, 2);
  leftLight.position.set(-5.8, 3.65, .3);
  scene.add(leftLight);

  return { sideSun, contactSun, windowLight, leftLight };
}
