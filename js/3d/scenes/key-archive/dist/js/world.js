import * as THREE from '../vendor/three.js';
import { KEY_TYPES, KEYS_PER_TYPE, getProgress } from './rules.js?v=21';
import { createKeyModel, createCombinedKeyGeometry, createBowGlyph, makeLabel, makePaintTexture } from './art.js?v=17';
import { sampleThrow } from './throw-physics.js';
import { getPaintedMetalTextures, getKeyPaint, METAL_BY_KEY_TYPE } from './painted-textures.js';
import {
  CABINET_Z, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS,
  CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_SHELF_DEPTH,
  CABINET_GRID_BOTTOM_Y, CABINET_BLANK_ROW_BOTTOM_Y, CABINET_SHELF_CENTER_Z,
  CABINET_PEG_LENGTH, CABINET_PEG_CENTER_Z, CABINET_GROUND_OFFSET,
  CABINET_OUTLINE, pegForSlot,
} from './cabinet-layout.js?v=20';
import { conditionTint, conditionMaterial } from './key-patina.js';
import { restingKeyY } from './floor-contact.js';
import { createWorkstations } from './wash-forge-stations.js?v=19';
import { createPaintedRenderer } from './painted-renderer.js?v=15';
import { createWetSnow } from './wet-snow.js?v=21';
import { createHallSurfaceMaterials, HALL_SURFACE_TILE_METERS } from './hall-surface-textures.js?v=23';
import { createMetricBoxGeometry } from './metric-box-geometry.js?v=23';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { createToonMaterials } from './toon-materials.js?v=15';
import { createInkOutlines } from './ink-outlines.js?v=16';
import {
  WINDOW_CENTERS, PILASTER_CENTERS, PERIMETER_BAND_Y,
  addArchedWindow, addWindowedWall, addVault,
} from './hall-architecture.js?v=23';

const ROOM = { halfWidth: 12, halfLength: 23.4, height: 11.25 };

function box(parent, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function roomBox(parent, size, position, material, tileMeters = HALL_SURFACE_TILE_METERS.trim) {
  const mesh = new THREE.Mesh(createMetricBoxGeometry(size, tileMeters), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, material, sides = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function createKeyHoverMaterial() {
  // Screen-space silhouette follows the true key shape, including broken teeth.
  // The earlier enlarged white copy disappeared beneath the mud/rust layers.
  return new THREE.ShaderMaterial({
    uniforms: { hoverOpacity: { value: 0 } },
    vertexShader: `
      void main() {
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        vec3 outward = normalize(normalMatrix * normal);
        vec4 projected = projectionMatrix * eye;
        vec2 direction = vec2(outward.x * projectionMatrix[0][0],
                              outward.y * projectionMatrix[1][1]);
        float distance = length(direction);
        if (distance > 0.0001) {
          float breadth = min(0.014, 0.22 * projectionMatrix[1][1] / max(1.0, -eye.z));
          projected.xy += direction / distance * projected.w * breadth;
        }
        gl_Position = projected;
      }
    `,
    fragmentShader: `
      uniform float hoverOpacity;
      void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, hoverOpacity); }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function createMaterials() {
  const paintedMetal = getPaintedMetalTextures();
  const wood = makePaintTexture('wood', 45);
  const floorWood = makePaintTexture('wood', 81);
  floorWood.repeat.set(7, 13);
  const plaster = makePaintTexture('plaster', 32);
  const carpetFallback = makePaintTexture('rug', 177);
  return {
    wood: new THREE.MeshStandardMaterial({ map: wood, color: 0xe2d1bd, roughness: .97 }),
    darkWood: new THREE.MeshStandardMaterial({ map: wood, color: 0xb69e90, roughness: .96 }),
    floor: new THREE.MeshStandardMaterial({ map: floorWood, color: 0xd8c6b4, roughness: .96 }),
    ...createHallSurfaceMaterials(plaster, wood, carpetFallback),
    blackWood: new THREE.MeshStandardMaterial({ map: wood, color: 0x695751, roughness: .97 }),
    cabinetBack: new THREE.MeshStandardMaterial({ color: 0x0b0d0d, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ map: paintedMetal.brass, color: 0xf4e5cc, roughness: .77, metalness: .26 }),
    darkBrass: new THREE.MeshStandardMaterial({ map: paintedMetal.brass, color: 0x9c826b, roughness: .84, metalness: .23 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x171d1d, roughness: .93 }),
    glass: new THREE.MeshBasicMaterial({ color: 0xabc9c2, transparent: true, opacity: .51, depthWrite: false }),
    windowLight: new THREE.MeshBasicMaterial({ color: 0xf7eacb, transparent: true, opacity: .23, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffd38a }),
  };
}

function makeHall(scene, mat, snow) {
  // The broad carpet makes the small metal objects legible from a standing view.
  const hallFloor = box(scene, [24, .28, 46.8], [0, -.19, 0], mat.floor);
  const carpet = box(scene, [16, .024, 37], [0, -.038, -.15], mat.hallCarpet);
  hallFloor.receiveShadow = true;
  carpet.receiveShadow = true;
  for (const x of [-7.92, 7.92]) box(scene, [.065, .016, 36.95], [x, -.018, -.15], mat.brass);
  for (const z of [-18.63, 18.33]) box(scene, [15.84, .016, .07], [0, -.018, z], mat.brass);

  // A gentle inlaid geometric pattern in the floor.
  const ringGeo = new THREE.RingGeometry(3.65, 3.69, 80);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9e7950, transparent: true, opacity: .35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -.024;
  scene.add(ring);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const dash = box(scene, [.055, .014, .8], [Math.cos(angle) * 4.1, -.019, Math.sin(angle) * 4.1], mat.darkBrass);
    dash.rotation.y = -angle;
  }

  for (const side of [-1, 1]) {
    addWindowedWall(scene, side, mat.hallWall);
    roomBox(scene, [.55, 1.15, 46.8], [side * 11.93, .53, 0], mat.hallTrim);
    roomBox(scene, [.54, .29, 46.8], [side * 11.77, PERIMETER_BAND_Y, 0], mat.hallTrim);
    for (const z of PILASTER_CENTERS) {
      roomBox(scene, [.83, 10.8, .63], [side * 11.76, 5.5, z],
        mat.hallPilaster, HALL_SURFACE_TILE_METERS.wall);
      roomBox(scene, [1.14, .34, .91], [side * 11.73, PERIMETER_BAND_Y, z], mat.hallTrim);
      roomBox(scene, [1.1, .29, .88], [side * 11.73, 10.66, z], mat.hallTrim);
    }
    for (const z of WINDOW_CENTERS) addArchedWindow(scene, side, z, mat, snow);
  }
  for (const z of [-23.39, 23.39]) {
    const endWall = box(scene, [24, 11, .42], [0, 5.50, z], mat.hallEnd);
    endWall.castShadow = true;
    roomBox(scene, [24, 1.15, .6], [0, .53, z + (z < 0 ? .13 : -.13)], mat.hallTrim);
    roomBox(scene, [24, .29, .65], [0, PERIMETER_BAND_Y, z + (z < 0 ? .1 : -.1)], mat.hallTrim);
  }

  addVault(scene, mat.hallVault, mat.hallBeam);

  // A sealed passage for a future chapter; its keyhole is not a key-family sign.
  box(scene, [5.5, 7.15, .4], [0, 3.67, -23.04], mat.darkBrass);
  box(scene, [4.67, 6.45, .43], [0, 3.39, -22.77], mat.blackWood);
  for (const x of [-1.6, -.8, 0, .8, 1.6])
    roomBox(scene, [.11, 6.15, .48], [x, 3.35, -22.51], mat.darkWood);
  for (const y of [1.1, 3.9, 6.3]) box(scene, [4.49, .12, .49], [0, y, -22.5], mat.brass);
  const keyholePlate = cylinder(scene, .42, .075, [0, 5.25, -22.14], mat.brass, 24);
  keyholePlate.rotation.x = Math.PI / 2;
  const keyholeTop = new THREE.Mesh(new THREE.SphereGeometry(.145, 12, 8), mat.ink);
  keyholeTop.scale.z = .18;
  keyholeTop.position.set(0, 5.30, -22.08);
  scene.add(keyholeTop);
  box(scene, [.17, .38, .045], [0, 5.07, -22.07], mat.ink);
  const backLabel = makeLabel('ЗАЛ ЗАБЫТЫХ ДВЕРЕЙ', 'за архивом · закрыто', { worldWidth: 4.45, worldHeight: .95, fontSize: 64 });
  backLabel.position.set(0, 8.43, -22.85);
  scene.add(backLabel);

  // A few side worktables add scale without blocking the sorting path.
  for (const x of [-9.3, 9.3]) for (const z of [-20.7, 20.7]) {
    box(scene, [1.75, .18, 2.25], [x, .83, z], mat.wood);
    for (const dx of [-.7, .7]) for (const dz of [-.9, .9])
      roomBox(scene, [.13, .8, .13], [x + dx, .35, z + dz], mat.darkWood);
    box(scene, [1.56, .05, 2.04], [x, .943, z], mat.darkBrass);
  }
}

function makeChandeliers(scene, mat) {
  for (const z of [-13, 0, 13]) {
    cylinder(scene, .036, 3.4, [0, 9.56, z], mat.darkBrass);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, .075, 8, 48), mat.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 7.95, z);
    scene.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const x = Math.cos(a) * 1.53;
      const offsetZ = Math.sin(a) * 1.53;
      cylinder(scene, .075, .32, [x, 8.1, z + offsetZ], mat.brass);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), mat.light);
      bulb.position.set(x, 8.29, z + offsetZ);
      scene.add(bulb);
    }
    const light = new THREE.PointLight(0xffcc8d, 18, 15, 2);
    light.position.set(0, 7.75, z);
    scene.add(light);
  }
}

function createCabinet(scene, type, mat) {
  const group = new THREE.Group();
  const left = type < 5;
  group.position.set(left ? -11.58 : 11.58, CABINET_GROUND_OFFSET, CABINET_Z[type % 5]);
  group.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
  scene.add(group);
  box(group, [3.64, 4.89, .57], [0, 2.43, -.04], mat.darkWood);
  box(group, [3.25, 3.79, .12], [0, 2.2, .29], mat.cabinetBack);
  box(group, [3.92, .33, .90], [0, .15, .13], mat.wood);
  box(group, [3.92, .24, .94], [0, 4.77, .11], mat.wood);
  for (const x of [-1.76, 1.76]) {
    box(group, [.26, 4.61, .78], [x, 2.43, .11], mat.wood);
    box(group, [.07, 4.55, .81], [x + Math.sign(x) * .12, 2.44, .12], mat.brass);
  }
  // One solid lower section supports four raised rows of square key compartments.
  box(group, [3.24, .36, .17], [0, .48, .45], mat.wood);
  box(group, [3.24, CABINET_ROW_HEIGHT, .17],
    [0, CABINET_BLANK_ROW_BOTTOM_Y + CABINET_ROW_HEIGHT / 2, .45], mat.darkWood);
  for (let divider = 0; divider <= CABINET_COLUMNS; divider++) {
    const x = -1.62 + divider * CABINET_COLUMN_WIDTH;
    box(group, [.065, CABINET_ROWS * CABINET_ROW_HEIGHT, CABINET_SHELF_DEPTH],
      [x, CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT / 2, CABINET_SHELF_CENTER_Z], mat.wood);
  }
  for (let row = 0; row <= CABINET_ROWS; row++) {
    const y = CABINET_GRID_BOTTOM_Y + row * CABINET_ROW_HEIGHT;
    box(group, [3.23, .078, CABINET_SHELF_DEPTH], [0, y, CABINET_SHELF_CENTER_Z], mat.wood);
    box(group, [3.22, .028, CABINET_SHELF_DEPTH], [0, y + .055, CABINET_SHELF_CENTER_Z + .01], mat.darkBrass);
  }
  const pegGeo = new THREE.CylinderGeometry(.013, .0215, CABINET_PEG_LENGTH, 8);
  pegGeo.rotateX(Math.PI / 2);
  const pegs = new THREE.InstancedMesh(pegGeo, mat.ink, CABINET_CAPACITY);
  const pegDummy = new THREE.Object3D();
  for (let index = 0; index < CABINET_CAPACITY; index++) {
    const peg = pegForSlot(index);
    pegDummy.position.set(peg.x, peg.y, CABINET_PEG_CENTER_Z);
    pegDummy.updateMatrix();
    pegs.setMatrixAt(index, pegDummy.matrix);
  }
  pegs.instanceMatrix.needsUpdate = true;
  pegs.userData.inkSkipOutline = true;
  group.add(pegs);
  box(group, [3.37, 1.14, .27], [0, 4.04, .39], mat.blackWood);
  const plaque = box(group, [3.27, .66, .05], [0, 4.17, .55], mat.darkBrass.clone());
  const label = makeLabel(KEY_TYPES[type].name.toUpperCase(), KEY_TYPES[type].mark, {
    worldWidth: 3.1, worldHeight: .67, fontSize: 79,
  });
  label.position.set(0, 4.18, .579);
  group.add(label);
  const glyph = createBowGlyph(type);
  glyph.scale.setScalar(1.4);
  // A narrow wooden mount fixes the emblem to the cabinet's upper cornice.
  box(group, [.17, 1.18, .19], [0, 5.25, .18], mat.darkWood);
  glyph.position.set(0, 5.85, .25);
  group.add(glyph);
  const border = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({
    color: 0xffffff, toneMapped: false, transparent: true, opacity: 0, depthWrite: false,
  });
  white.userData.inkSkipOutline = true;
  const { bottom: borderBottom, top: borderTop, front: borderFront,
    width: borderWidth, thickness: borderThickness } = CABINET_OUTLINE;
  for (const y of [borderBottom, borderTop]) {
    const stroke = box(border, [borderWidth, borderThickness, .06], [0, y, borderFront], white);
    stroke.renderOrder = 20;
  }
  for (const x of [-borderWidth / 2, borderWidth / 2]) {
    const stroke = box(border, [borderThickness, borderTop - borderBottom, .06],
      [x, (borderTop + borderBottom) / 2, borderFront], white);
    stroke.renderOrder = 20;
  }
  border.visible = false;
  group.add(border);
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(3.82, 4.65, .15),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  collider.position.set(0, 2.53, .74);
  collider.userData = { kind: 'cabinet', type };
  group.add(collider);

  const inserted = new THREE.InstancedMesh(createCombinedKeyGeometry(type),
    new THREE.MeshStandardMaterial({ map: getKeyPaint(type), color: 0xf4e7d3, roughness: .78, metalness: .26 }), CABINET_CAPACITY);
  inserted.count = 0;
  inserted.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inserted.frustumCulled = false;
  group.add(inserted);
  const dummy = new THREE.Object3D();
  const adornment = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd889 }));
  adornment.material.userData.inkSkipOutline = true;
  adornment.position.set(0, 4.8, .45);
  adornment.visible = false;
  group.add(adornment);
  function refresh(keys, hiddenCount = 0, required = CABINET_CAPACITY) {
    inserted.count = Math.max(0, Math.min(keys.length - hiddenCount, CABINET_CAPACITY));
    for (let i = 0; i < inserted.count; i++) {
      const peg = pegForSlot(i);
      dummy.position.set(peg.x, peg.y - .063, peg.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(.185);
      dummy.updateMatrix();
      inserted.setMatrixAt(i, dummy.matrix);
    }
    inserted.instanceMatrix.needsUpdate = true;
    adornment.visible = keys.length === required;
    plaque.material.emissive = new THREE.Color(keys.length === required ? 0x8a5a1d : 0x000000);
    plaque.material.emissiveIntensity = keys.length === required ? .35 : 0;
  }
  let hoverAmount = 0;
  let hoverTarget = 0;
  function setHovered(value) { hoverTarget = value ? 1 : 0; }
  function updateHover(factor) {
    hoverAmount += (hoverTarget - hoverAmount) * factor;
    white.opacity = hoverAmount;
    border.visible = hoverAmount > .005;
  }
  return { type, group, collider, border, refresh, setHovered, updateHover };
}

function addDust(scene) {
  const positions = new Float32Array(270 * 3);
  let seed = 32;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (next() - .5) * 22;
    positions[i + 1] = .5 + next() * 9;
    positions[i + 2] = (next() - .5) * 44;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geometry,
    new THREE.PointsMaterial({ color: 0xe4d6b3, size: .043, transparent: true, opacity: .4, sizeAttenuation: true, depthWrite: false }));
  scene.add(dust);
  return dust;
}

export function createWorld(canvas, state, visualSettings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Window geometry is static, so render the costly sunlight shadow map once.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.76;
  renderer.setClearColor(0x35433d, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3e4f47);
  scene.fog = new THREE.FogExp2(0x536459, .010);
  const camera = new THREE.PerspectiveCamera(73, 1, .055, 120);
  camera.position.set(0, PLAYER_EYE_HEIGHT, 20.2);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xe4f0e3, 0x635b4e, 2.9));
  const daylight = new THREE.DirectionalLight(0xfff0cf, 4.1);
  daylight.position.set(-19, 17, -6);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1536, 1536);
  Object.assign(daylight.shadow.camera, { left: -33, right: 33, top: 33, bottom: -33,
    near: 1, far: 75 });
  daylight.shadow.camera.updateProjectionMatrix();
  daylight.shadow.bias = -.0007;
  daylight.shadow.normalBias = .035;
  daylight.shadow.radius = 3;
  scene.add(daylight);
  const cool = new THREE.DirectionalLight(0xa2c6ca, 1.0);
  cool.position.set(9, 5, 8);
  scene.add(cool);

  const mat = createMaterials();
  const snow = createWetSnow();
  const hall = new THREE.Group();
  scene.add(hall);
  makeHall(hall, mat, snow);
  makeChandeliers(hall, mat);
  const applyWindowDaylight = settings => {
    const strength = settings.windowDaylight / 100;
    daylight.intensity = 5.4 * strength;
    mat.windowLight.opacity = .05 + .16 * strength;
  };
  applyWindowDaylight(visualSettings);
  const dust = addDust(scene);
  // The optional color pass handles the pigment wash; the Village Engine ink
  // module draws the same screen-space silhouettes as the other KEYNLOCK scenes.
  const painted = createPaintedRenderer(renderer, scene, camera,
    { ...visualSettings, outlineEnabled: false, outlineStrength: 0 });
  snow.setSettings(visualSettings);
  const cabinets = KEY_TYPES.map((_, index) => createCabinet(scene, index, mat));
  const workstations = createWorkstations(scene, mat, state);
  const floorKeys = new Map(); // key ID -> its family batch and instance index
  const keysByType = KEY_TYPES.map(() => []);
  for (const key of state.keys) keysByType[key.type].push(key);
  const interactables = [...cabinets.map(cabinet => cabinet.collider), ...workstations.interactables];
  const colliderGeometry = new THREE.BoxGeometry(.43, .21, .65);
  const colliderMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const floorBatches = KEY_TYPES.map((family, type) => {
    const material = new THREE.MeshStandardMaterial({
      map: getKeyPaint(type),
      color: METAL_BY_KEY_TYPE[type] === 'steel' ? 0xe4ebf0 : 0xf5e5d0,
      metalness: .28, roughness: .78,
    });
    const healthyKeys = keysByType[type].filter(key => !key.broken);
    const damagedKeys = keysByType[type].filter(key => key.broken);
    const muddyKeys = healthyKeys.filter(key => key.mud);
    const rustyKeys = healthyKeys.filter(key => key.rust);
    const healthy = new THREE.InstancedMesh(createCombinedKeyGeometry(type), material, healthyKeys.length);
    const damaged = new THREE.InstancedMesh(createCombinedKeyGeometry(type, true), material, damagedKeys.length);
    const mudHalo = new THREE.InstancedMesh(createCombinedKeyGeometry(type),
      new THREE.MeshBasicMaterial({ color: 0x534536, depthWrite: false }), muddyKeys.length);
    const mudPaint = new THREE.InstancedMesh(createCombinedKeyGeometry(type),
      conditionMaterial(type, 'mud'), muddyKeys.length);
    const rustPaint = new THREE.InstancedMesh(createCombinedKeyGeometry(type),
      conditionMaterial(type, 'rust'), rustyKeys.length);
    const collider = new THREE.InstancedMesh(colliderGeometry, colliderMaterial, KEYS_PER_TYPE);
    for (const instance of [healthy, damaged, mudHalo, mudPaint, rustPaint, collider]) {
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instance.frustumCulled = false;
    }
    collider.userData = { kind: 'key-batch', type };
    scene.add(mudHalo, healthy, damaged, mudPaint, rustPaint, collider);
    interactables.push(collider);
    keysByType[type].forEach((key, index) => {
      const list = key.broken ? damagedKeys : healthyKeys;
      const visibleIndex = list.indexOf(key);
      floorKeys.set(key.id, { type, index, broken: key.broken, visibleIndex,
        mudIndex: key.mud ? muddyKeys.indexOf(key) : -1,
        rustIndex: key.rust ? rustyKeys.indexOf(key) : -1 });
      (key.broken ? damaged : healthy).setColorAt(visibleIndex,
        new THREE.Color(conditionTint(key)).multiplyScalar([.94, 1, .83][key.variation % 3]));
    });
    if (healthy.instanceColor) healthy.instanceColor.needsUpdate = true;
    if (damaged.instanceColor) damaged.instanceColor.needsUpdate = true;
    return { healthy, damaged, mudHalo, mudPaint, rustPaint, collider, material };
  });
  const keyOutline = new THREE.Mesh(createCombinedKeyGeometry(0), createKeyHoverMaterial());
  keyOutline.renderOrder = 5;
  keyOutline.raycast = () => {};
  keyOutline.visible = false;
  scene.add(keyOutline);
  const dummy = new THREE.Object3D();
  const thrownKeys = new Map();
  const placingKeys = new Map();
  const discardingKeys = new Map();
  const hand = new THREE.Group();
  hand.position.set(.43, -.45, -.82);
  camera.add(hand);
  const handLight = new THREE.PointLight(0xffd6a1, 2.2, 3);
  handLight.position.set(.3, -.3, -.5);
  camera.add(handLight);
  let displayedHandId = null;
  let handModel = null;
  let hovered = null;
  let keyHoverOpacity = 0;
  let keyHoverTarget = 0;
  let lastHoverFrame = performance.now();
  let highlightedShape = '0:false';
  const toonMaterials = createToonMaterials(scene, renderer);
  toonMaterials.setSettings(visualSettings);
  const inkOutlines = createInkOutlines(scene, visualSettings);
  inkOutlines.register(hall, { strokeScale: .65 });
  cabinets.forEach(cabinet => inkOutlines.register(cabinet.group));
  workstations.stations.forEach(station => inkOutlines.register(station.group));
  floorBatches.forEach(batch => {
    inkOutlines.register(batch.healthy);
    inkOutlines.register(batch.damaged);
  });

  function refreshHand(key) {
    if (displayedHandId === (key?.id || null)) return;
    if (handModel) {
      toonMaterials.unregister(handModel);
      inkOutlines.unregister(handModel);
      hand.remove(handModel);
      handModel.traverse(part => {
        if (part.isMesh && part.material?.userData?.conditionDisposable) part.material.dispose();
      });
    }
    displayedHandId = key?.id || null;
    handModel = null;
    if (!key) return;
    handModel = createKeyModel(key.type, { scale: .52, variation: key.variation, broken: key.broken });
    if (key.mud || key.rust) {
      const tint = new THREE.Color(conditionTint(key));
      handModel.traverse(part => {
        if (!part.isMesh || !part.material?.color || part.material.metalness === undefined) return;
        part.material = part.material.clone();
        part.material.color.multiply(tint);
        part.material.userData.conditionDisposable = true;
      });
      if (key.mud) {
        const crustMaterial = new THREE.MeshBasicMaterial({ color: 0x514435, side: THREE.BackSide });
        crustMaterial.userData.conditionDisposable = true;
        const crust = new THREE.Mesh(createCombinedKeyGeometry(key.type),
          crustMaterial);
        crust.scale.setScalar(1.085);
        handModel.add(crust);
      }
      for (const kind of ['mud', 'rust']) if (key[kind]) {
        const material = conditionMaterial(key.type, kind);
        material.userData.conditionDisposable = true;
        const coat = new THREE.Mesh(createCombinedKeyGeometry(key.type), material);
        coat.position.z = .012 + (kind === 'rust' ? .004 : 0);
        handModel.add(coat);
      }
    }
    handModel.rotation.set(-.12, -.34, -.53);
    hand.add(handModel);
    toonMaterials.register(handModel);
    inkOutlines.register(handModel);
  }

  function syncKey(key) {
    const instance = floorKeys.get(key.id);
    if (!instance) return;
    const batch = floorBatches[instance.type];
    const mesh = instance.broken ? batch.damaged : batch.healthy;
    const visible = key.status === 'floor' && !thrownKeys.has(key.id);
    const restingY = restingKeyY(key.x, key.z) + (key.layer || 0);
    dummy.position.set(key.x, restingY, key.z);
    dummy.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
    dummy.scale.setScalar(visible ? .455 : .000001);
    dummy.updateMatrix();
    mesh.setMatrixAt(instance.visibleIndex, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    for (const [kind, index, coat, scale, rise] of [
      ['mud', instance.mudIndex, batch.mudHalo, .501, -.010],
      ['mud', instance.mudIndex, batch.mudPaint, .458, .007],
      ['rust', instance.rustIndex, batch.rustPaint, .46, .009],
    ]) {
      if (index < 0) continue;
      dummy.position.set(key.x, restingY + rise, key.z);
      dummy.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
      dummy.scale.setScalar(visible && key[kind] ? scale : .000001);
      dummy.updateMatrix();
      coat.setMatrixAt(index, dummy.matrix);
      coat.instanceMatrix.needsUpdate = true;
    }
    dummy.position.set(key.x, restingY + .105, key.z);
    dummy.rotation.set(0, key.rotation, 0);
    dummy.scale.setScalar(visible ? 1 : .000001);
    dummy.updateMatrix();
    batch.collider.setMatrixAt(instance.index, dummy.matrix);
    batch.collider.instanceMatrix.needsUpdate = true;
  }

  function keyIdFromHit(type, instanceId) {
    return keysByType[type]?.[instanceId]?.id || null;
  }

  function animateThrow(key, start, end) {
    const model = new THREE.Mesh(createCombinedKeyGeometry(key.type, key.broken), floorBatches[key.type].material);
    model.scale.setScalar(.455);
    scene.add(model);
    toonMaterials.register(model);
    inkOutlines.register(model);
    thrownKeys.set(key.id, { key, start, end, startTime: performance.now(), model });
    syncKey(key);
  }

  function isThrowing(keyId) { return thrownKeys.has(keyId); }

  function animatePlace(key, slotIndex) {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const cabinet = cabinets[key.type];
    cabinet.group.updateMatrixWorld(true);
    const peg = pegForSlot(slotIndex);
    const end = cabinet.group.localToWorld(new THREE.Vector3(peg.x, peg.y, peg.z));
    const model = createKeyModel(key.type, { variation: key.variation });
    model.position.y = -.063;
    const pivot = new THREE.Group();
    pivot.add(model);
    scene.add(pivot);
    toonMaterials.register(pivot);
    inkOutlines.register(pivot);
    placingKeys.set(key.id, {
      key, start, end, pivot, model, startTime: performance.now(),
      startRotation: camera.quaternion.clone(), endRotation: cabinet.group.quaternion.clone(),
    });
    refreshCabinet(key.type);
  }

  function animateDiscard(key, stationId = 'near') {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const station = workstations.stations.find(item => item.id === stationId) || workstations.stations[2];
    station.group.updateMatrixWorld(true);
    const end = station.group.localToWorld(new THREE.Vector3(0, 1.48, .08));
    const model = createKeyModel(key.type, { variation: key.variation, broken: true });
    scene.add(model);
    toonMaterials.register(model);
    inkOutlines.register(model);
    discardingKeys.set(key.id, { start, end, model, startTime: performance.now() });
  }

  function refreshCabinet(type) {
    const keys = state.keys.filter(key => key.type === type && key.status === 'sorted');
    const hiding = [...placingKeys.values()].filter(motion => motion.key.type === type).length;
    cabinets[type].refresh(keys, hiding, getProgress(state).required[type]);
  }
  cabinets.forEach((_, type) => refreshCabinet(type));
  for (const key of state.keys) syncKey(key);

  function highlight(target) {
    cabinets.forEach(cabinet => cabinet.setHovered(target?.kind === 'cabinet' && target.type === cabinet.type));
    workstations.highlight(target);
    hovered = target;
    keyHoverTarget = target?.kind === 'key' ? 1 : 0;
    if (keyHoverTarget) {
      const key = state.keys.find(item => item.id === target.id);
      if (key) {
        const shape = `${key.type}:${key.broken}`;
        if (shape !== highlightedShape) {
          highlightedShape = shape;
          keyOutline.geometry = createCombinedKeyGeometry(key.type, key.broken);
        }
        // Share the key's depth so its front hides the white shell's inner faces.
        keyOutline.position.set(key.x, restingKeyY(key.x, key.z) + (key.layer || 0), key.z);
        keyOutline.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
        keyOutline.scale.setScalar(.455);
      } else {
        keyHoverTarget = 0;
      }
    }
  }

  function update(now, moving) {
    const elapsed = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
    cabinets.forEach(cabinet => cabinet.updateHover(hoverFactor));
    keyHoverOpacity += (keyHoverTarget - keyHoverOpacity) * hoverFactor;
    keyOutline.material.uniforms.hoverOpacity.value = keyHoverOpacity;
    keyOutline.visible = keyHoverOpacity > .005;
    dust.position.y = Math.sin(now * .00035) * .08;
    snow.update(now);
    workstations.update(now);
    inkOutlines.update();
    for (const [id, motion] of thrownKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      const pose = sampleThrow(motion.start, motion.end, elapsed);
      if (pose.landed) {
        thrownKeys.delete(id);
        toonMaterials.unregister(motion.model);
        inkOutlines.unregister(motion.model);
        scene.remove(motion.model);
        syncKey(motion.key);
        continue;
      }
      motion.model.position.set(pose.x, pose.y, pose.z);
      const settle = Math.min(1, Math.max(0, (elapsed - .5) / 1.2));
      const eased = 1 - (1 - settle) ** 3;
      motion.model.rotation.set(
        pose.spin - Math.PI * .5 * eased,
        pose.spin * .11 * (1 - eased) + motion.key.rotation * eased,
        Math.sin(pose.spin) * .18 * (1 - eased),
        'YXZ',
      );
    }
    for (const [id, motion] of placingKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      const travel = Math.min(elapsed / .30, 1);
      const easing = 1 - (1 - travel) ** 3;
      motion.pivot.position.lerpVectors(motion.start, motion.end, easing);
      motion.pivot.position.y += Math.sin(Math.PI * travel) * .16;
      motion.pivot.quaternion.slerpQuaternions(motion.startRotation, motion.endRotation, easing);
      motion.model.scale.setScalar(.185 + .27 * (1 - easing));
      if (elapsed > .30) {
        const swayTime = elapsed - .30;
        motion.pivot.rotateZ(Math.sin(swayTime * 15) * .18 * Math.exp(-swayTime * 2.6));
      }
      if (elapsed < 1.65) continue;
      toonMaterials.unregister(motion.pivot);
      inkOutlines.unregister(motion.pivot);
      scene.remove(motion.pivot);
      placingKeys.delete(id);
      refreshCabinet(motion.key.type);
    }
    for (const [id, motion] of discardingKeys) {
      const elapsed = (now - motion.startTime) / 1000;
      if (elapsed > .48) {
        toonMaterials.unregister(motion.model);
        inkOutlines.unregister(motion.model);
        scene.remove(motion.model);
        discardingKeys.delete(id);
        continue;
      }
      const progress = elapsed / .48;
      const ease = 1 - (1 - progress) ** 3;
      motion.model.position.lerpVectors(motion.start, motion.end, ease);
      motion.model.position.y += Math.sin(Math.PI * progress) * .26;
      motion.model.rotation.set(ease * Math.PI * 1.3, ease * Math.PI * 1.1, 0);
      motion.model.scale.setScalar(.38 * (1 - ease) + .04);
    }
    if (handModel) {
      hand.rotation.z = Math.sin(now * .0031) * (moving ? .045 : .012);
      hand.position.y = -.45 + Math.sin(now * .0029) * (moving ? .035 : .012);
    }
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    painted.resize();
  }
  resize();
  window.addEventListener('resize', resize);

  return {
    THREE, scene, camera, renderer: { render: painted.render }, interactables, cabinets, workstations, floorKeys,
    refreshHand, syncKey, refreshCabinet, highlight, update, resize,
    setVisualSettings(settings) {
      applyWindowDaylight(settings);
      toonMaterials.setSettings(settings);
      inkOutlines.setSettings(settings);
      painted.setSettings({ ...settings, outlineEnabled: false, outlineStrength: 0 });
      snow.setSettings(settings);
    },
    keyIdFromHit, animateThrow, animatePlace, animateDiscard, isThrowing, throwingCount: () => thrownKeys.size,
    progress: () => getProgress(state),
    bounds: { x: ROOM.halfWidth - .88, z: ROOM.halfLength - .87 },
  };
}
