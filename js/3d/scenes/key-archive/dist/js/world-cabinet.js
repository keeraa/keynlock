import { familyName } from './i18n.js';
import * as THREE from '../vendor/three.js';
import { KEY_TYPES } from './rules.js?v=key-ring';
import { makeLabel } from './art.js?v=key-ring';
import { createCombinedKeyGeometry, getKeyMaterial, getKeyDisplayScale } from './key-factory.js?v=key-ring';
import { createPaintedInstanceGeometry } from './key-instance-finish.js?v=wax-and-bundles';
import { KEY_ART } from './key-art.js';
import { PERIMETER_BAND_Y } from './hall-architecture.js?v=alchemy-candles';
import { createCabinetCompletion } from './cabinet-completion.js?v=wax-and-bundles';
import { CABINET_Z, CABINET_GRID_WIDTH, CABINET_GRID_HALF_WIDTH, CABINET_BODY_WIDTH, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS, CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_SHELF_DEPTH, CABINET_GRID_BOTTOM_Y, CABINET_HEADER_HEIGHT, CABINET_HEADER_Y, CABINET_CORNICE_TOP, CABINET_SHELF_CENTER_Z, CABINET_GROUND_OFFSET, CABINET_BACK_FRONT_Z, CABINET_CROWN_SCALE_FACTOR, cabinetKeyPose } from './cabinet-layout.js?v=cabinet-cell-glow';
import { createCabinetFinish, createRoundedShelfGeometry } from './cabinet-finish.js?v=cabinet-cell-glow';
import { createMetricBoxGeometry } from './metric-box-geometry.js?v=23';
import { box, contactShadow } from './world-architecture.js?v=key-ring';

function addTrimInstances(group, instances, material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, instances.length);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < instances.length; index++) {
    const { size, position } = instances[index];
    dummy.position.set(...position);
    dummy.scale.set(...size);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  group.add(mesh);
}

const sideGeometry = createMetricBoxGeometry([.26, CABINET_CORNICE_TOP - .35, .78], 1.8);
const shelfGeometries = new Map();
const cabinetFinishes = new WeakMap();

function addRoundedShelf(group, y, height, material) {
  if (!shelfGeometries.has(height)) {
    shelfGeometries.set(height, createRoundedShelfGeometry(CABINET_GRID_WIDTH - .01, height, CABINET_SHELF_DEPTH));
  }
  const shelf = new THREE.Mesh(shelfGeometries.get(height), material);
  shelf.position.set(0, y, CABINET_SHELF_CENTER_Z);
  group.add(shelf);
}

export function createCabinet(scene, type, materials) {
  if (!cabinetFinishes.has(materials)) cabinetFinishes.set(materials, createCabinetFinish(materials));
  const finish = cabinetFinishes.get(materials);
  const mat = { ...materials, wood: finish.wood, darkWood: finish.darkWood,
    carvedWood: finish.carvedWood, cabinetWalnut: finish.walnut };
  const group = new THREE.Group();
  const left = type < 5;
  group.position.set(left ? -11.58 : 11.58, CABINET_GROUND_OFFSET, CABINET_Z[type % 5]);
  group.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
  group.scale.z = .5; // Half-depth cabinet and individual key compartments.
  scene.add(group);
  contactShadow(group, CABINET_BODY_WIDTH + .5, 1.55, 0, .006, .14, mat.contactShadow);
  const bodyHeight = CABINET_CORNICE_TOP - .13;
  box(group, [CABINET_GRID_WIDTH + .40, bodyHeight, .57], [0, bodyHeight / 2, -.04], mat.cabinetWalnut);
  const cellLightValues = new Uint8Array(CABINET_CAPACITY);
  const cellLights = new THREE.DataTexture(cellLightValues, CABINET_COLUMNS * 2, CABINET_ROWS * 2, THREE.RedFormat);
  cellLights.needsUpdate = true;
  box(group, [CABINET_GRID_WIDTH + .01, CABINET_CORNICE_TOP - .5, .12],
    [0, (CABINET_CORNICE_TOP - .5) / 2 + .31, CABINET_BACK_FRONT_Z - .06], finish.createRecess(cellLights));
  box(group, [CABINET_BODY_WIDTH - .08, .33, .90], [0, .15, .13], mat.cabinetWalnut);
  box(group, [CABINET_BODY_WIDTH - .12, .20, .83], [0, CABINET_CORNICE_TOP - .20, .11], mat.cabinetWalnut);
  box(group, [CABINET_BODY_WIDTH, .10, .92], [0, CABINET_CORNICE_TOP - .05, .10], mat.carvedWood);
  for (const x of [-CABINET_GRID_HALF_WIDTH - .14, CABINET_GRID_HALF_WIDTH + .14]) {
    const side = new THREE.Mesh(sideGeometry, mat.cabinetWalnut);
    side.position.set(x, (CABINET_CORNICE_TOP + .23) / 2, .11);
    group.add(side);
  }
  const lowerPanelHeight = CABINET_GRID_BOTTOM_Y - .32;
  box(group, [CABINET_GRID_WIDTH, lowerPanelHeight, .17], [0, .32 + lowerPanelHeight / 2, .45], mat.darkWood);
  const halfRow = CABINET_ROW_HEIGHT / 2;
  const cellWidth = CABINET_COLUMN_WIDTH / 2;
  const mainShelfThickness = .078;
  const innerShelfThickness = .036;
  const uprightInstances = [];
  const inlayInstances = [];
  // Every upright occupies only the space between shelves. Full-height bars
  // overlapped horizontal boards on the same front plane and z-fought at joins.
  for (let divider = 0; divider <= CABINET_COLUMNS * 2; divider++) {
    const x = -CABINET_GRID_HALF_WIDTH + divider * cellWidth;
    const thickness = divider % 2 === 0 ? .065 : .034;
    for (let section = 0; section < CABINET_ROWS * 2; section++) {
      const bottomThickness = section % 2 === 0 ? mainShelfThickness : innerShelfThickness;
      const topThickness = section % 2 === 0 ? innerShelfThickness : mainShelfThickness;
      const span = halfRow - (bottomThickness + topThickness) / 2 - .004;
      const centerY = CABINET_GRID_BOTTOM_Y + (section + .5) * halfRow +
        (bottomThickness - topThickness) / 4;
      uprightInstances.push({ size: [thickness, span, CABINET_SHELF_DEPTH],
        position: [x, centerY, CABINET_SHELF_CENTER_Z] });
    }
  }
  for (let row = 0; row <= CABINET_ROWS; row++) {
    const y = CABINET_GRID_BOTTOM_Y + row * CABINET_ROW_HEIGHT;
    addRoundedShelf(group, y, mainShelfThickness, finish.shelf);
    // Narrow brass inlay sits lower on the front lip, not over the shelf's
    // whole top face. Split at uprights to avoid overlapping coplanar surfaces.
    for (let column = 0; column < CABINET_COLUMNS * 2; column++) {
      const x = -CABINET_GRID_HALF_WIDTH + (column + .5) * cellWidth;
      const front = CABINET_SHELF_CENTER_Z + CABINET_SHELF_DEPTH / 2;
      inlayInstances.push({ size: [cellWidth - .076, .023, .021],
        position: [x, y + .014, front + .013] });
    }
  }
  // A finer 12 × 8 grid creates 96 actual cubbies; no hanging pegs remain.
  for (let row = 0; row < CABINET_ROWS; row++) {
    const y = CABINET_GRID_BOTTOM_Y + (row + .5) * CABINET_ROW_HEIGHT;
    addRoundedShelf(group, y, innerShelfThickness, finish.shelf);
  }
  // Two draw calls for all uprights and brass lips instead of ~170 small meshes.
  addTrimInstances(group, uprightInstances, mat.wood);
  addTrimInstances(group, inlayInstances, mat.darkBrass);
  box(group, [CABINET_GRID_WIDTH + .13, CABINET_HEADER_HEIGHT, .27], [0, CABINET_HEADER_Y, .39], mat.carvedWood);
  const label = makeLabel(familyName(type).toUpperCase(), '', {
    worldWidth: CABINET_GRID_WIDTH - .46, worldHeight: .45, fontSize: 111, color: '#ead0a0',
  });
  label.position.set(0, CABINET_HEADER_Y, .531);
  group.add(label);
  // Each cabinet carries its own monumental key. The lower blade is buried
  // inside the cabinet, leaving the matching head and neck above the cornice.
  // Forge geometry already has its head at +Y; no additional rotation needed.
  const crownGeometry = createCombinedKeyGeometry(type);
  crownGeometry.computeBoundingBox();
  const headCenter = crownGeometry.userData.headCenterY ?? crownGeometry.boundingBox.max.y - .16;
  const crestCenterY = (CABINET_CORNICE_TOP + PERIMETER_BAND_Y - CABINET_GROUND_OFFSET) / 2;
  const headHeight = Math.max(.01, 2 * (crownGeometry.boundingBox.max.y - headCenter));
  const crownScale = Math.min(4.48,
    (PERIMETER_BAND_Y - CABINET_CORNICE_TOP - CABINET_GROUND_OFFSET) * .86 / headHeight) * CABINET_CROWN_SCALE_FACTOR;
  const crownMaterial = getKeyMaterial(type).clone();
  crownMaterial.emissiveMap = crownMaterial.map;
  const crownKey = new THREE.Mesh(crownGeometry, crownMaterial);
  crownKey.position.set(0, crestCenterY - headCenter * crownScale, -.24);
  crownKey.scale.setScalar(crownScale);
  crownKey.userData.headCenterY = crestCenterY;
  crownKey.castShadow = true;
  crownKey.frustumCulled = false;
  // On a flat key pressed close to the wall, the shared depth/normal pass has
  // little contrast to detect. Supplement its visible metal edges with the
  // same ink pigment, keeping the scene's contour controls authoritative.
  const crownContour = new THREE.LineSegments(
    new THREE.EdgesGeometry(crownKey.geometry, 35),
    new THREE.LineBasicMaterial({ color: KEY_ART.outline.ink, transparent: true,
      opacity: .56, depthTest: true, depthWrite: false }));
  crownContour.position.z = .008;
  crownKey.add(crownContour);
  group.add(crownKey);
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(CABINET_GRID_WIDTH + .58, CABINET_CORNICE_TOP - .29, .15),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  collider.position.set(0, (CABINET_CORNICE_TOP + .29) / 2, .74);
  collider.userData = { kind: 'cabinet', type };
  group.add(collider);

  const inserted = new THREE.InstancedMesh(
    createPaintedInstanceGeometry(createCombinedKeyGeometry(type), CABINET_CAPACITY),
    getKeyMaterial(type), CABINET_CAPACITY);
  inserted.count = 0;
  inserted.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inserted.frustumCulled = false;
  group.add(inserted);
  const completion = createCabinetCompletion();
  let litKeys = [];
  let lastSettledRows = 0;
  const cellFlashes = new Map();
  let cellLightingDirty = false;
  // The backing reads a tiny per-cabinet mask, so glowing cells share its draw call.
  function updateCellLights(settledRows) {
    lastSettledRows = settledRows;
    cellLightValues.fill(0);
    for (const key of litKeys) {
      const row = Math.floor(key.cabinetSlot / (CABINET_COLUMNS * 2));
      cellLightValues[key.cabinetSlot] = settledRows & (1 << row) ? 225 : 140;
    }
    for (const [slot, strength] of cellFlashes) {
      cellLightValues[slot] = Math.max(cellLightValues[slot], Math.round(255 * strength));
    }
    cellLightingDirty = false;
    cellLights.needsUpdate = true;
  }
  function flashCell(slot, strength) {
    if (!strength && !cellFlashes.has(slot)) return;
    if (strength) cellFlashes.set(slot, strength);
    else cellFlashes.delete(slot);
    cellLightingDirty = true;
  }
  function pulsePanel(width, height, y, z, gain = 1) {
    const material = new THREE.ShaderMaterial({
      uniforms: { uGain: { value: gain }, uSweep: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 } },
      vertexShader: 'varying vec2 vPulseUv; void main(){vPulseUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 vPulseUv; uniform float uSweep,uFlash,uFade,uGain;
        void main(){
          float band=exp(-pow((vPulseUv.x-(uSweep*1.24-.12))/.095,2.0));
          float edge=smoothstep(0.0,.10,vPulseUv.y)*smoothstep(0.0,.10,1.0-vPulseUv.y)
            *smoothstep(0.0,.045,vPulseUv.x)*smoothstep(0.0,.045,1.0-vPulseUv.x);
          float light=(band*.56 + uFlash*.48 + step(vPulseUv.x,uSweep)*.045)*uFade*edge*uGain;
          gl_FragColor=vec4(vec3(1.0,.72,.31),light);
          #include <colorspace_fragment>
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false,
    });
    material.userData.inkSkipOutline = true;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    panel.position.set(0, y, z); panel.visible = false; panel.renderOrder = 4;
    group.add(panel); return panel;
  }
  const rowPulses = Array.from({ length: CABINET_ROWS * 2 }, (_, row) =>
    pulsePanel(CABINET_GRID_WIDTH, CABINET_ROW_HEIGHT / 2,
      CABINET_GRID_BOTTOM_Y + (CABINET_ROWS * 2 - row - .5) * CABINET_ROW_HEIGHT / 2, .55));
  const cabinetPulse = pulsePanel(CABINET_BODY_WIDTH, CABINET_CORNICE_TOP, CABINET_CORNICE_TOP / 2, .86, .60);
  function warmEffects(renderer, camera) {
    // Compile the shared celebration program before play, using the same linear
    // offscreen color space as the scene pass. The first earned row must not hitch.
    const target = new THREE.WebGLRenderTarget(1, 1);
    const previous = renderer.getRenderTarget();
    const warmScene = new THREE.Scene();
    warmScene.add(new THREE.Mesh(rowPulses[0].geometry, rowPulses[0].material));
    try { renderer.setRenderTarget(target); renderer.compile(warmScene, camera); }
    finally { renderer.setRenderTarget(previous); target.dispose(); }
  }
  function applyPulse(panel, pulse) {
    panel.visible = Boolean(pulse);
    if (!pulse) return;
    panel.material.uniforms.uSweep.value = pulse.sweep;
    panel.material.uniforms.uFlash.value = pulse.flash;
    panel.material.uniforms.uFade.value = pulse.fade;
  }
  function update(now) {
    const frame = completion.frame(now);
    if (litKeys.length || cellLightingDirty) {
      const settledRows = completion.settledRows();
      if (cellLightingDirty || settledRows !== lastSettledRows) updateCellLights(settledRows);
    }
    rowPulses.forEach(panel => { panel.visible = false; });
    for (const row of frame.rows) applyPulse(rowPulses[row.row], row);
    applyPulse(cabinetPulse, frame.cabinet);
    crownMaterial.emissive.setHex(0xfff1d4);
    crownMaterial.emissiveIntensity = frame.crownGlow;
  }
  const dummy = new THREE.Object3D();
  function refresh(keys, hiddenIds = new Set(), required = CABINET_CAPACITY) {
    for (const slot of cellFlashes.keys()) if (!keys.some(key => key.cabinetSlot === slot)) flashCell(slot, 0);
    const visible = keys.filter(key => !hiddenIds.has(key.id));
    completion.refresh(visible);
    if (visible.length || litKeys.length) {
      litKeys = visible;
      updateCellLights(completion.settledRows());
    }
    inserted.count = Math.min(visible.length, CABINET_CAPACITY);
    for (let i = 0; i < inserted.count; i++) {
      const peg = cabinetKeyPose(visible[i].cabinetSlot, getKeyDisplayScale('cabinet', type));
      dummy.position.set(peg.x, peg.y, peg.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(peg.scale);
      dummy.updateMatrix();
      inserted.setMatrixAt(i, dummy.matrix);
    }
    inserted.instanceMatrix.needsUpdate = true;
  }
  function setContour(settings) {
    const strength = Math.max(0, Math.min(100, Number(settings.outlineStrength) || 0));
    crownContour.visible = Boolean(settings.outlineEnabled) && strength > 0;
    crownContour.material.opacity = strength * .008;
  }
  return { type, group, collider, refresh, flashCell, setContour, update, completion, warmEffects };
}
