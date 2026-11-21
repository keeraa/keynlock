// @ts-check
import { ROOM_CENTER_Z, ROOM_LENGTH } from './layout.js';

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
  contactSun.position.set(0, 28, ROOM_CENTER_Z);
  contactSun.target.position.set(0, 0, ROOM_CENTER_Z);
  contactSun.castShadow = true;
  contactSun.shadow.mapSize.set(2048, 2048);
  contactSun.shadow.camera.near = .4;
  contactSun.shadow.camera.far = 50;
  contactSun.shadow.camera.left = -12;
  contactSun.shadow.camera.right = 12;
  contactSun.shadow.camera.top = ROOM_LENGTH / 2 + 4;
  contactSun.shadow.camera.bottom = -contactSun.shadow.camera.top;
  contactSun.shadow.bias = -.00022;
  contactSun.shadow.normalBias = .02;
  scene.add(contactSun, contactSun.target);

  const windowLight = new THREE.PointLight('#e9c090', 25, 11, 2);
  windowLight.position.set(-.3, 4.55, -4.8);
  scene.add(windowLight);
  const leftLight = new THREE.PointLight('#ffd5aa', 12, 8, 2);
  leftLight.position.set(-5.8, 3.65, .3);
  scene.add(leftLight);

  // Night: the window side turns to cool moonlight; the lamps stay warm.
  const hemisphere = scene.children.find(light => light.isHemisphereLight);
  const day = { sky: hemisphere.color.clone(), hemi: hemisphere.intensity, side: sideSun.color.clone(),
    sideIntensity: sideSun.intensity, window: windowLight.color.clone(), windowIntensity: windowLight.intensity };
  const night = { sky: new THREE.Color('#9fb1d6'), side: new THREE.Color('#9db4dc'), window: new THREE.Color('#8fa9d6') };
  /** 0 = day, 1 = night, or in between while it changes. */
  function setNight(/** @type {number | boolean} */ value) {
    const a = Math.max(0, Math.min(1, Number(value)));
    hemisphere.color.lerpColors(day.sky, night.sky, a);
    hemisphere.intensity = day.hemi * (1 - .38 * a);
    sideSun.color.lerpColors(day.side, night.side, a);
    sideSun.intensity = day.sideIntensity * (1 - .6 * a);
    windowLight.color.lerpColors(day.window, night.window, a);
    windowLight.intensity = day.windowIntensity * (1 - .45 * a);
  }

  return { sideSun, contactSun, windowLight, leftLight, setNight };
}
