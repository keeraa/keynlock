import * as THREE from '../vendor/three.js';

export const ARCHIVE_LEDGER_URL = new URL('../assets/gouache-archive-ledger-v1.webp', import.meta.url).href;
export const ARCHIVE_DESK = Object.freeze({ x: 9.3, y: .968, z: 20.7, width: 1.75, depth: 2.25 });
export const ARCHIVE_SIDE_TABLES = Object.freeze([
  ARCHIVE_DESK,
  { x: -ARCHIVE_DESK.x, z: -ARCHIVE_DESK.z },
  { x: ARCHIVE_DESK.x, z: -ARCHIVE_DESK.z },
]);

export const ARCHIVE_LEDGER = Object.freeze({
  x: 9.19, y: ARCHIVE_DESK.y, z: 20.54, yaw: -Math.PI / 2 + .14, width: .88, depth: .58,
});

export function createLedgerCollider() {
  const { x, y, z, yaw, width, depth } = ARCHIVE_LEDGER;
  const collider = new THREE.Mesh(new THREE.BoxGeometry(width + .034, .053, depth + .032),
    new THREE.MeshBasicMaterial({ visible: false }));
  collider.position.set(x, y + .025, z);
  collider.rotation.y = yaw;
  collider.userData = { kind: 'ledger' };
  return collider;
}

export function addArchiveLedger(scene, materials) {
  const { x, y, z, yaw, width, depth } = ARCHIVE_LEDGER;
  const prop = new THREE.Group();
  prop.position.set(x, y, z);
  prop.rotation.y = yaw;
  scene.add(prop);
  const book = new THREE.Group();
  prop.add(book);
  const collider = createLedgerCollider();
  scene.add(collider);
  function add(geometry, material, x, y, z, parent = prop) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  const paper = new THREE.MeshStandardMaterial({ color: 0xbc9e76, roughness: .99 });
  const map = new THREE.TextureLoader().load(ARCHIVE_LEDGER_URL);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  add(new THREE.BoxGeometry(width + .035, .019, depth + .035), materials.cabinetWalnut, 0, .010, 0, book);
  add(new THREE.BoxGeometry(width, .022, depth), paper, 0, .029, 0, book);

  // The gouache is a single spread. Slightly raised pages meet at a low binding.
  const spread = new THREE.PlaneGeometry(width, depth, 12, 1).rotateX(-Math.PI / 2);
  const points = spread.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const edge = Math.abs(points.getX(i)) * 2 / width;
    points.setY(i, .042 + Math.sin(edge * Math.PI) * .018 + edge * .004);
  }
  spread.computeVertexNormals();
  add(spread, new THREE.MeshStandardMaterial({ map, color: 0xfff0df, roughness: .98 }), 0, 0, 0, book);

  const pencil = add(new THREE.CylinderGeometry(.011, .011, .27, 6),
    materials.carvedWood, .54, .013, .04);
  pencil.rotation.set(Math.PI / 2, 0, .26);
  const tip = add(new THREE.ConeGeometry(.011, .035, 6), paper, .502, .013, .186);
  tip.rotation.set(Math.PI / 2, 0, .26);

  const tag = add(new THREE.BoxGeometry(.22, .009, .13), paper, -.48, .006, .36);
  tag.rotation.y = -.26;
  const wax = new THREE.MeshStandardMaterial({ color: 0x733635, roughness: .84 });
  add(new THREE.CylinderGeometry(.035, .039, .011, 10), wax, -.426, .014, .368);
  const stamp = add(new THREE.TorusGeometry(.022, .003, 4, 12), wax, -.426, .020, .368);
  stamp.rotation.x = -Math.PI / 2;
  return { book, collider };
}
