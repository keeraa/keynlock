import * as THREE from '../vendor/three.js';
import { KEY_TYPES } from './rules.js?v=22';
import { makeLabel } from './art.js?v=17';
import { createCombinedKeyGeometry, getKeyMaterial, getKeyDisplayScale } from './key-factory.js?v=3';
import { createPaintedInstanceGeometry } from './key-instance-finish.js';
import { CABINET_Z, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS, CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_SHELF_DEPTH, CABINET_GRID_BOTTOM_Y, CABINET_BLANK_ROW_BOTTOM_Y, CABINET_SHELF_CENTER_Z, CABINET_GROUND_OFFSET, cabinetKeyPose } from './cabinet-layout.js?v=22';
import { box, contactShadow } from './world-architecture.js';

export function createCabinet(scene, type, mat) {
  const group = new THREE.Group();
  const left = type < 5;
  group.position.set(left ? -11.58 : 11.58, CABINET_GROUND_OFFSET, CABINET_Z[type % 5]);
  group.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
  group.scale.z = .5; // Half-depth cabinet and individual key compartments.
  scene.add(group);
  contactShadow(group, 4.5, 1.55, 0, .006, .14, mat.contactShadow);
  box(group, [3.64, 4.89, .57], [0, 2.43, -.04], mat.cabinetWalnut);
  box(group, [3.25, 3.79, .12], [0, 2.2, .29], mat.cabinetBack);
  box(group, [3.92, .33, .90], [0, .15, .13], mat.cabinetWalnut);
  box(group, [3.92, .24, .94], [0, 4.77, .11], mat.cabinetWalnut);
  // Shallow stepped cornice and worn carved rails provide a furniture silhouette.
  box(group, [4.05, .11, 1.02], [0, 4.91, .10], mat.carvedWood);
  box(group, [3.80, .09, .84], [0, 5.01, .13], mat.darkWood);
  box(group, [3.84, .07, .81], [0, .34, .13], mat.carvedWood);
  for (const x of [-1.76, 1.76]) {
    box(group, [.26, 4.61, .78], [x, 2.43, .11], mat.cabinetWalnut);
    box(group, [.045, 4.55, .81], [x + Math.sign(x) * .12, 2.44, .12], mat.agedBronze);
    box(group, [.065, 3.61, .07], [x - Math.sign(x) * .095, 2.40, .512], mat.carvedWood);
    box(group, [.35, .23, .79], [x, .12, .11], mat.darkWood);
    box(group, [.33, .13, .76], [x, .30, .11], mat.carvedWood);
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
  // A finer 12 × 8 grid creates 96 actual cubbies; no hanging pegs remain.
  for (let divider = 0; divider < CABINET_COLUMNS; divider++) {
    const x = -1.62 + (divider + .5) * CABINET_COLUMN_WIDTH;
    box(group, [.034, CABINET_ROWS * CABINET_ROW_HEIGHT, CABINET_SHELF_DEPTH],
      [x, CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT / 2, CABINET_SHELF_CENTER_Z], mat.wood);
  }
  for (let row = 0; row < CABINET_ROWS; row++) {
    const y = CABINET_GRID_BOTTOM_Y + (row + .5) * CABINET_ROW_HEIGHT;
    box(group, [3.23, .036, CABINET_SHELF_DEPTH], [0, y, CABINET_SHELF_CENTER_Z], mat.wood);
  }
  box(group, [3.37, 1.14, .27], [0, 4.04, .39], mat.blackWood);
  const plaque = box(group, [3.27, .66, .05], [0, 4.17, .55], mat.darkBrass.clone());
  const label = makeLabel(KEY_TYPES[type].name.toUpperCase(), '', {
    worldWidth: 2.52, worldHeight: .67, fontSize: 100,
  });
  label.position.set(.31, 4.18, .585);
  group.add(label);
  const plaqueGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.46, .80), new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main() {
        vec2 p = (vUv - .5) * vec2(2.0, 2.0);
        float glow = exp(-dot(p, p) * 4.8) * .30;
        // Fade before reaching the plane boundary: no rectangular cut-off.
        float fade = smoothstep(0.0, .22, vUv.x) * smoothstep(0.0, .22, 1.0-vUv.x)
          * smoothstep(0.0, .2, vUv.y) * smoothstep(0.0, .2, 1.0-vUv.y);
        gl_FragColor = vec4(vec3(1.0, .78, .51), glow * fade); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  plaqueGlow.position.set(-1.27, 4.18, .607);
  group.add(plaqueGlow);
  const plaqueKey = new THREE.Mesh(createCombinedKeyGeometry(type), getKeyMaterial(type));
  plaqueKey.position.set(-1.27, 4.18, .635);
  plaqueKey.scale.setScalar(.23 * 2.7 * .8);
  plaqueKey.rotation.z = -Math.PI / 2;
  group.add(plaqueKey);
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(3.82, 4.65, .15),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  collider.position.set(0, 2.53, .74);
  collider.userData = { kind: 'cabinet', type };
  group.add(collider);

  const inserted = new THREE.InstancedMesh(
    createPaintedInstanceGeometry(createCombinedKeyGeometry(type), CABINET_CAPACITY),
    getKeyMaterial(type), CABINET_CAPACITY);
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
      const peg = cabinetKeyPose(i, getKeyDisplayScale('cabinet', type));
      dummy.position.set(peg.x, peg.y, peg.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(peg.scale);
      dummy.updateMatrix();
      inserted.setMatrixAt(i, dummy.matrix);
    }
    inserted.instanceMatrix.needsUpdate = true;
    adornment.visible = keys.length === required;
    plaque.material.emissive = new THREE.Color(keys.length === required ? 0x8a5a1d : 0x000000);
    plaque.material.emissiveIntensity = keys.length === required ? .35 : 0;
  }
  return { type, group, collider, refresh };
}
