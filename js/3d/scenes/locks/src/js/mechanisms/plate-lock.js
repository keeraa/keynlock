import { PLATE_SYMBOLS } from './plate-symbols.js';
import { PLATE_COUNT, PLATE_MAX_COUNT, PLATE_POSITIONS } from '../gameplay/plate-rules.js';
import { TENSION_TOOL_CLEARANCE } from './pin-tools.js';

export const PLATE_HOLE_STEP = .30;
export const PLATE_ROW_STEP = .384;
// The drilled strips sit behind the front inspection face (z=.6625 inner side).
export const PLATE_FRONT_OFFSET_Z = .395;
export const plateRowY = (index, count) => ((count - 1) / 2 - index) * PLATE_ROW_STEP;
export const plateFrameScale = count => count === 4 ? .69 : count === 5 ? .82 : .97;
export const PLATE_ROWS = Object.freeze(Array.from({length:PLATE_COUNT},(_,index)=>plateRowY(index,PLATE_COUNT)));

/** A continuous steel strip drilled through with seven discrete circular holes. */
export function createPlateBodyGeometry(THREE) {
  const width = 2.82, height = .37, radius = .075;
  const halfW = width / 2, halfH = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + radius, -halfH);
  shape.lineTo(halfW - radius, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + radius);
  shape.lineTo(halfW, halfH - radius);
  shape.quadraticCurveTo(halfW, halfH, halfW - radius, halfH);
  shape.lineTo(-halfW + radius, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - radius);
  shape.lineTo(-halfW, -halfH + radius);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + radius, -halfH);
  shape.closePath();

  for (let j = 0; j < PLATE_POSITIONS; j++) {
    const hole = new THREE.Path();
    hole.absarc((j - 3) * PLATE_HOLE_STEP, 0, .085, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth: .09, steps: 1, bevelEnabled: false, curveSegments: 32,
  });
}

function symbolGeometries(THREE) {
  return PLATE_SYMBOLS.map(symbol => symbol.strokes.map(stroke => {
    const points = stroke.map(([x, y]) => new THREE.Vector3(x, y, 0));
    const path = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++)
      path.add(new THREE.LineCurve3(points[i - 1], points[i]));
    return new THREE.TubeGeometry(path, Math.max(12, stroke.length * 3), .052, 5, false);
  }));
}

/** Six built rows, showing four to six solid drilled plates with one-piece pegs. */
export function buildPlateMechanism({ THREE, root, modeGroups, raisedMechanism,
  mat, addMesh, part, tag, box, ring, model, pickRigTemplate, tensionModelsTemplate,
  pinHousingTemplate, keywayInsertTemplate, coreCenterY, coreCenterZ }) {
  const group = new THREE.Group();
  group.position.set(0, raisedMechanism, PLATE_FRONT_OFFSET_Z);
  root.add(group);
  modeGroups.plate = group;

  // The casing already has a genuine side bore. Reuse the exact cylinder
  // entrance and slotted insert from the pin lock at the very same axis.
  const plateHousing = pinHousingTemplate.clone(true);
  plateHousing.position.z = -PLATE_FRONT_OFFSET_Z;
  group.add(plateHousing);
  const plateKeywayRig = new THREE.Group();
  plateKeywayRig.position.set(0, coreCenterY, coreCenterZ - PLATE_FRONT_OFFSET_Z);
  plateKeywayRig.scale.copy(keywayInsertTemplate.parent.scale);
  const plateKeywayInsert = keywayInsertTemplate.clone(true);
  plateKeywayRig.add(plateKeywayInsert);
  group.add(plateKeywayRig);

  // Recess the plates inside the casing. Frame posts run outside the ball
  // detents in X; the perforated strips clear the detents along Z.
  const frame = new THREE.Group();
  group.add(frame);
  box(frame, .13, 2.69, .15, -1.65, 0, -.02, mat.edge, .025);
  box(frame, .13, 2.69, .15, 1.65, 0, -.02, mat.edge, .025);
  for (const y of [-1.32, 1.32])
    box(frame, 3.36, .10, .13, 0, y, -.06, mat.inner, .035);
  frame.scale.y = plateFrameScale(model.plateCount);
  part(frame, [0, 0, -.8], .53, 'Каркас пластинчатого замка',
    'Неподвижная жёсткая опора для четырёх, пяти или шести пластин.');

  const plateGeometry = createPlateBodyGeometry(THREE);
  // One axial peg: its round crown looks like a disc from the front,
  // while its shaft is seated in the recessed carriage behind the plate.
  const pinGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0,0),new THREE.Vector2(.044,0),
    new THREE.Vector2(.057,.012),new THREE.Vector2(.057,.179),
    new THREE.Vector2(.062,.192),new THREE.Vector2(.071,.201),
    new THREE.Vector2(.071,.211),new THREE.Vector2(.065,.218),
    new THREE.Vector2(.034,.224),new THREE.Vector2(0,.226),
  ],32);
  pinGeometry.rotateX(Math.PI/2);
  const motifs = symbolGeometries(THREE);
  const plates = [], pins = [], symbolGroups = [];
  for (let i = 0; i < PLATE_MAX_COUNT; i++) {
    const row = new THREE.Group();
    row.position.set(0, plateRowY(i, model.plateCount), 0);
    row.visible = i < model.plateCount;
    group.add(row);
    const plateMesh = addMesh(row, plateGeometry, mat.dark, [0, 0, .17]);
    plateMesh.userData.baseMaterial = plateMesh.material;
    plateMesh.userData.selectedMaterial = plateMesh.material.clone();
    plateMesh.userData.selectedMaterial.emissive.setHex(0x60451e);
    plateMesh.userData.selectedMaterial.emissiveIntensity = .68;
    tag(plateMesh, `Пластина ${i + 1}`, 'Цельная стальная полоса с семью отдельными круглыми отверстиями.');
    plateMesh.userData.plateIndex = i;
    // The right engraving is a horizontal reflection of the left one;
    // both occupy a narrower strip than the original motifs.
    const marks = [];
    for (const x of [-1.245, 1.245]) {
      const variants = PLATE_SYMBOLS.map((symbol, index) => {
        const mark = new THREE.Group();
        mark.position.set(x, 0, .266);
        mark.scale.set(x < 0 ? .068 : -.068, .105, .105);
        row.add(mark);
        for (const geometry of motifs[index]) addMesh(mark, geometry, mat.brass);
        return mark;
      });
      marks.push(variants);
    }
    symbolGroups.push(marks);

    // Narrow metal lips follow actual holes, with solid steel between them.
    for (let j = 0; j < PLATE_POSITIONS; j++) {
      const x = (j - 3) * PLATE_HOLE_STEP;
      ring(row, .091, .006, x, 0, .265, mat.inner, 'z');
    }

    // Two continuous guides support a sliding steel carriage one layer behind
    // the perforated strip. Unoccupied holes remain genuinely open.
    for (const y of [-.135,.135])
      box(row, 2.56, .046, .058, 0, y, .055, mat.edge, .012);

    const pin = new THREE.Group();
    row.add(pin);
    pin.position.x = ((model.plates[i]?.position || 4) - 4) * PLATE_HOLE_STEP;
    pin.userData.travel = {goal:pin.position.x,phase:'settled'};
    const pinMount = new THREE.Group();
    pinMount.position.x = pin.position.x;
    row.add(pinMount);
    const mountBody = box(pinMount, .245, .177, .072, 0, 0, .084, mat.inner, .022);
    tag(mountBody, `Каретка штифта ${i + 1}`,
      'Крепит штифт к задним направляющим; его стержень скользит через отверстие пластины.');
    mountBody.userData.plateIndex = i;
    for (const y of [-.126,.126])
      box(pinMount, .31, .040, .051, 0, y, .055, mat.steel, .012);
    ring(pinMount, .066, .010, 0, 0, .124, mat.brass, 'z');
    const shaft = addMesh(pin, pinGeometry, mat.steel, [0,0,.043]);
    shaft.userData.plateIndex = i;
    tag(shaft, `Штифт пластины ${i + 1}`,
      'Круглая головка выходит из отверстия при совпадении позиции; нижняя часть удерживается задней кареткой.');
    pin.userData.shaft = shaft;
    const solvedMark = ring(pin, .074, .007, 0, 0, .264, mat.brass, 'z');
    solvedMark.visible = false;
    pin.userData.solvedMark = solvedMark;
    pins.push(pin);

    // A discreet selection marker follows the plate but does not cross its slot.
    const indicator = ring(row, .037, .011, -1.445, 0, .267, mat.brass, 'z');
    plates.push({ row, plateMesh, pinMount, indicator });
    part(row, [(i % 2 ? 1 : -1), (i - 1.5) * .24, .3], .45,
      `Подвижная пластина ${i + 1}`);
  }

  const toolRig = new THREE.Group();
  toolRig.position.z = -PLATE_FRONT_OFFSET_Z;
  toolRig.visible = false;
  group.add(toolRig);
  // Preserve the original picking tools' *full* scale and seating. The pick
  // travels along the same cylinder axis, while the tensioner stays by the
  // entrance; neither shaft tracks the front-facing rows of plates.
  const platePickRig = pickRigTemplate.clone(true);
  platePickRig.position.set(-3.25, coreCenterY, coreCenterZ);
  platePickRig.rotation.set(0, 0, 0);
  platePickRig.visible = true;
  toolRig.add(platePickRig);
  const plateTensionRig = new THREE.Group();
  plateTensionRig.position.set(-3.75, coreCenterY + TENSION_TOOL_CLEARANCE.y,
    coreCenterZ + TENSION_TOOL_CLEARANCE.z);
  plateTensionRig.scale.copy(platePickRig.scale);
  toolRig.add(plateTensionRig);
  const plateTensionModels = tensionModelsTemplate.map(template => {
    const wrench = template.clone(true);
    wrench.visible = false;
    plateTensionRig.add(wrench);
    return wrench;
  });
  // Both children are independently animated by the shared part/dynamic-base
  // system, exactly as the two pin tools are. Registering only their parent
  // would leave the inserted meshes motionless in the actual render loop.
  part(platePickRig, [-1, .3, .7], .75, 'Отмычка',
    'Оригинальная отмычка входит в боковую цилиндрическую скважину.');
  part(plateTensionRig, [-1, -.2, .5], .75, 'Натяжитель',
    'Полноразмерный натяжитель удерживается у входа в скважину и подбирается по знаку пластин.');

  return { plateGroup: group, plateHousing, plateKeywayRig, plateKeywayInsert,
    frame, plates, pins, symbolGroups, toolRig, platePickRig, plateTensionRig,
    plateTensionModels, model, coreCenterY, coreCenterZ };
}
