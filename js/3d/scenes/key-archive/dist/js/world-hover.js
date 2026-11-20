import * as THREE from '../vendor/three.js';
import { createCombinedKeyGeometry, getKeyDisplayScale } from './key-factory.js';
import { createKeyHoverOutline } from './key-hover-outline.js';
import { restingKeyY } from './floor-contact.js';
import { pegForSlot, CABINET_CELL_INNER_HALF_WIDTH, CABINET_CELL_INNER_HALF_HEIGHT,
  CABINET_CELL_BACK_Z, CABINET_COLUMNS, CABINET_COLUMN_WIDTH, CABINET_GRID_BOTTOM_Y,
  CABINET_GRID_TOP_Y, CABINET_SHELF_CENTER_Z, CABINET_SHELF_DEPTH } from './cabinet-layout.js';

// What the player looks at gets a painted contour: a floor key, a cabinet
// (plus a glowing frame on the aimed cell), a bath or a key in it, the forge
// and the ledger. Contours fade in and out; a picked-up key loses its at once.
export function createWorldHover({ renderer, camera, scene, painted, cabinets, ledger, workstations, keysById }) {
  const keyOutline = new THREE.Mesh(createCombinedKeyGeometry(0));
  keyOutline.raycast = () => {};
  keyOutline.visible = false;
  const hoverOutline = createKeyHoverOutline(renderer, camera, keyOutline);
  // All interactable silhouettes share the same post-render pixel contour as keys.
  const objectMask = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objectMask.matrixAutoUpdate = false;
  objectMask.visible = false;
  const objectOutline = createKeyHoverOutline(renderer, camera, objectMask, { depthAware: true });
  const cabinetGridHeight = CABINET_GRID_TOP_Y - CABINET_GRID_BOTTOM_Y;
  const cabinetGridCenterY = CABINET_GRID_BOTTOM_Y + cabinetGridHeight / 2;
  const cabinetGridFrontZ = CABINET_SHELF_CENTER_Z + CABINET_SHELF_DEPTH / 2;
  const cabinetMaskGeometry = new THREE.PlaneGeometry(CABINET_COLUMNS * CABINET_COLUMN_WIDTH, cabinetGridHeight);
  const innerW = CABINET_CELL_INNER_HALF_WIDTH;
  const innerH = CABINET_CELL_INNER_HALF_HEIGHT;
  const cellOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-innerW, -innerH, 0), new THREE.Vector3(innerW, -innerH, 0),
    new THREE.Vector3(innerW, innerH, 0), new THREE.Vector3(-innerW, innerH, 0),
  ]), new THREE.LineBasicMaterial({ color: 0xffe4ad, depthTest: true, depthWrite: false }));
  const cellGlow = new THREE.Mesh(new THREE.PlaneGeometry(innerW * 2, innerH * 2),
    new THREE.MeshBasicMaterial({ color: 0xffdb94, transparent: true, opacity: .17, depthWrite: false }));
  const cellHighlight = new THREE.Group();
  cellHighlight.add(cellGlow, cellOutline);
  cellHighlight.matrixAutoUpdate = false;
  cellHighlight.visible = false;
  scene.add(cellHighlight);

  let keyHoverOpacity = 0;
  let keyHoverTarget = 0;
  let objectHoverOpacity = 0;
  let objectHoverTarget = 0;
  let highlightedShape = '0:false';
  let hoverAnchor = null;
  let outlinedKeyId = null;

  function highlight(target) {
    hoverAnchor = null;
    const interactive = target?.kind === 'cabinet' || target?.kind === 'bath' || target?.kind === 'forge' || target?.kind === 'ledger';
    objectHoverTarget = interactive ? (target.kind === 'cabinet' ? .74 : 1) : 0;
    cellHighlight.visible = false;
    if (interactive) {
      if (target.kind === 'cabinet') {
        const cabinet = cabinets[target.type];
        cabinet.group.updateWorldMatrix(true, false);
        // Match the plane of the shelf fronts so the frame stays on the grid.
        objectMask.matrix.copy(cabinet.group.matrixWorld)
          .multiply(new THREE.Matrix4().makeTranslation(0, cabinetGridCenterY, cabinetGridFrontZ));
        objectMask.geometry = cabinetMaskGeometry;
        if (Number.isInteger(target.slot)) {
          const peg = pegForSlot(target.slot);
          cellHighlight.matrix.copy(cabinet.group.matrixWorld)
            .multiply(new THREE.Matrix4().makeTranslation(peg.x, peg.y, CABINET_CELL_BACK_Z + .002));
          cellHighlight.matrixWorldNeedsUpdate = true;
          cellHighlight.visible = true;
        }
      } else if (target.kind === 'ledger') {
        ledger.collider.updateWorldMatrix(true, false);
        objectMask.matrix.copy(ledger.collider.matrixWorld);
        objectMask.matrixWorldNeedsUpdate = true;
        objectMask.geometry = ledger.collider.geometry;
      } else {
        const surface = workstations.getHoverSurface(target);
        if (!surface) { objectHoverTarget = 0; return; }
        surface.anchor.updateWorldMatrix(true, false);
        objectMask.matrix.copy(surface.anchor.matrixWorld);
        objectMask.geometry = surface.geometry;
        // A key in a bath bobs and dips: its outline follows it every frame.
        hoverAnchor = target.keyId ? surface.anchor : null;
      }
    }
    keyHoverTarget = target?.kind === 'key' ? 1 : 0;
    outlinedKeyId = keyHoverTarget ? target.id : outlinedKeyId;
    if (keyHoverTarget) {
      const key = keysById.get(target.id);
      if (key) {
        const shape = `${key.type}:${key.broken}`;
        if (shape !== highlightedShape) {
          highlightedShape = shape;
          // The outline borrows the factory geometry shared by the floor batches.
          keyOutline.geometry = createCombinedKeyGeometry(key.type, key.broken);
        }
        // Exact geometry mask: its screen-space outer edge also traces holes.
        keyOutline.position.set(key.x, restingKeyY(key.x, key.z) + (key.layer || 0), key.z);
        keyOutline.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
        keyOutline.scale.setScalar(getKeyDisplayScale('floor', key.type));
      } else {
        keyHoverTarget = 0;
      }
    }
  }

  function update(elapsed) {
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
    keyHoverOpacity += (keyHoverTarget - keyHoverOpacity) * hoverFactor;
    objectHoverOpacity += (objectHoverTarget - objectHoverOpacity) * hoverFactor;
    // A picked-up key leaves the floor at once: drop its outline without the fade.
    if (outlinedKeyId && keysById.get(outlinedKeyId)?.status !== 'floor') {
      keyHoverOpacity = 0;
      outlinedKeyId = null;
    }
    keyOutline.visible = keyHoverOpacity > .005;
    objectMask.visible = objectHoverOpacity > .005;
    if (hoverAnchor?.parent) {
      hoverAnchor.updateWorldMatrix(true, false);
      objectMask.matrix.copy(hoverAnchor.matrixWorld);
      objectMask.matrixWorldNeedsUpdate = true;
    }
  }

  // Runs after the painted scene: contours are drawn over the finished frame.
  function render() {
    const dustCoverage = painted.getDustCoverage();
    try { hoverOutline.render(keyHoverOpacity, dustCoverage); }
    catch (error) { console.warn('KEYNLOCK: hover silhouette unavailable', error); }
    // A key in a bath is outlined whole, even the part under the liquid.
    try { objectOutline.render(objectHoverOpacity, hoverAnchor ? null : dustCoverage, painted.getSceneDepth()); }
    catch (error) { console.warn('KEYNLOCK: object silhouette unavailable', error); }
  }

  return {
    highlight, update, render,
    hideObject() { objectHoverOpacity = 0; },
    getPassCount: () => hoverOutline.getPassCount() + objectOutline.getPassCount(),
  };
}
