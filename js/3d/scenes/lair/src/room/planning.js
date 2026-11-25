// @ts-check
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeMapTexture } from './materials.js';
import { WINDOW_OPENING } from './window.js';

// The planning table in the middle of the room.
export function buildPlanning(kit) {
  const { m, staticGroup, box, cylinder, sphere, rod, plane, zoneTarget, makeTable } = kit;
  function makePaper(parent, x, y, z, rotation = 0, size = [.53, .76]) {
    const sheet = new THREE.Group();
    sheet.position.set(x, y, z);
    sheet.rotation.y = rotation;
    parent.add(sheet);
    box(sheet, size[0], .013, size[1], m.paper, 0, .0065, 0);
    for (let i = 0; i < 6; i++) {
      // Ruled lines are drawn flat on the sheet: tiny raised strips came out
      // as dashes in the ink outline.
      const line = plane(sheet, size[0] * .64, .006, m.paperDark, 0, .0134, -size[1] * .31 + i * .07);
      line.rotation.x = -Math.PI / 2;
    }
    return sheet;
  }

  const rugTop = .0505;
  const deskSurfaceY = .96;
  const tabletopThickness = .10;
  const matThickness = .03;
  const tableWidth = 2.95;
  const tableDepth = 1.55;
  const tableZ = 1.44;
  const table = makeTable(staticGroup, tableWidth, tableDepth, -.05, tableZ,
    deskSurfaceY - tabletopThickness / 2, rugTop, tabletopThickness,
    Math.sign(WINDOW_OPENING.wallZ - tableZ));
  table.name = 'planning-main-table';
  const matTop = deskSurfaceY + matThickness;
  box(table, 2.63, matThickness, tableDepth - .25, m.leather, 0, deskSurfaceY + matThickness / 2, 0, .012)
    .name = 'planning-desk-mat';
  makePaper(table, -.52, matTop, .07, -.16, [.75, .94]);
  makePaper(table, .48, matTop, -.10, .12, [.75, .95]);
  box(table, .43, .12, .5, m.darkWood, -.97, matTop + .06, -.35, .02);
  box(table, .48, .04, .56, m.paperDark, -.97, matTop + .14, -.35);
  cylinder(table, .17, .17, .025, m.brass, .12, matTop + .0125, .44, 28);
  rod(table, [.13, matTop + .035, .46], [.45, matTop + .01, .43], .012, m.iron);
  rod(table, [-.95, matTop + .013, .36], [-.64, matTop + .013, .12], .014, m.paper);
  // The enlarged window leaves a narrow wall bay for the planning board.
  const wallZ = WINDOW_OPENING.wallZ;
  const wallBayX = 6.33;
  const board = new THREE.Group(); board.position.set(wallBayX, 3.37, wallZ + .045); staticGroup.add(board);
  board.name = 'planning-wall-board';
  box(board, 2.27, 1.75, .10, m.darkWood);
  const map = makeMapTexture();
  const mapPaper = box(board, 2.05, 1.50, .012, new THREE.MeshStandardMaterial({ map, roughness: 1 }), 0, 0, .055);
  mapPaper.castShadow = mapPaper.receiveShadow = false;
  for (const [x, y] of [[-.56,.42],[.48,-.25],[-.12,-.35]]) {
    sphere(board, .064, m.ruby, x, y, .12, 9);
    cylinder(board, .022, .027, .095, m.oldBrass, x, y, .09, 10).rotation.x = Math.PI / 2;
  }
  const shelfZ = wallZ + .25;
  const shelf = box(staticGroup, 1.9, .12, .52, m.walnut, wallBayX - .1, 1.98, shelfZ);
  shelf.name = 'planning-wall-shelf';
  shelf.castShadow = false;
  zoneTarget('planning', [table.position.x, 1.15, 1.28], [tableWidth + .45, 2.3, tableDepth + .65]);
  return [table];
}

/** Set the book stack onto the shelf using the model's actual bottom face. */
export async function loadPlanningBooks(scene) {
  const url = new URL('../vendor/sikisi/books-strapped/books-strapped.glb', import.meta.url);
  const { scene: books } = await new GLTFLoader().loadAsync(url.href);
  const shelf = scene.getObjectByName('planning-wall-shelf');
  const bounds = new THREE.Box3().setFromObject(shelf);
  books.name = 'planning-shelf-books';
  books.scale.setScalar(1.8);
  bounds.getCenter(books.position);
  books.position.x += .22;
  books.position.y = bounds.max.y;
  books.rotation.y = .12;
  books.position.y += bounds.max.y - new THREE.Box3().setFromObject(books).min.y;
  books.traverse(object => {
    if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
  });
  scene.add(books);
}
