import { TENSION_TOOL_CLEARANCE } from '../mechanisms/pin-tools.js';
import { PLATE_HOLE_STEP, plateRowY, plateFrameScale } from '../mechanisms/plate-lock.js';
import { PLATE_SYMBOL_TO_WRENCH } from '../mechanisms/plate-symbols.js';

/** Retract each peg before crossing solid steel, then reseat it in a drilled hole. */
export function createPlateMotion({ model, frame, plates, pins, symbolGroups, toolRig,
  platePickRig, plateTensionRig, plateTensionModels, coreCenterY, coreCenterZ,
  setDynamicBase }) {
  return ({ D }) => {
    const count = model.plates.length;
    frame.scale.y = plateFrameScale(count);
    for (let i = 0; i < plates.length; i++) {
      const {row,pinMount,indicator,plateMesh} = plates[i];
      const plate = model.plates[i];
      const wasVisible = row.visible;
      row.visible = !!plate;
      if (!plate) continue;
      setDynamicBase(row,0,plateRowY(i,count),0);
      const pin = pins[i], destination = (plate.position - 4) * PLATE_HOLE_STEP;
      const travel = pin.userData.travel;
      if (!wasVisible) {
        pin.position.x = destination;pin.position.z = 0;
        pin.userData.shaft.scale.z = 1;
        travel.goal = destination;travel.phase = 'settled';
      }
      if (Math.abs(travel.goal - destination) > 1e-6) {
        travel.goal = destination;travel.phase = 'retract';
      }
      if (travel.phase === 'retract') {
        pin.position.z = D(pin.position.z,-.19,25);
        if (Math.abs(pin.position.z+.19) < .008) travel.phase = 'translate';
      } else if (travel.phase === 'translate') {
        pin.position.x = D(pin.position.x,travel.goal,16);
        if (Math.abs(pin.position.x-travel.goal) < .007) travel.phase = 'extend';
      } else if (travel.phase === 'extend') {
        pin.position.z = D(pin.position.z,0,24);
        if (Math.abs(pin.position.z) < .008) {
          pin.position.z = 0;travel.phase = 'settled';
        }
      }
      // The carriage stays below the plate while the peg retracts through its
      // sleeve; only the axial shaft extends farther at the solved position.
      pinMount.position.x = pin.position.x;
      const solved = plate.position === 4 && travel.phase === 'settled';
      pin.userData.shaft.scale.z = D(pin.userData.shaft.scale.z, solved ? 1.24 : 1, 14);
      pin.userData.solvedMark.visible = solved;
      indicator.visible = i === model.selectedPlate;
      plateMesh.material = i === model.selectedPlate ?
        plateMesh.userData.selectedMaterial : plateMesh.userData.baseMaterial;
      for (const variants of symbolGroups[i])
        variants.forEach((mark, index) => { mark.visible = index === plate.symbol; });
    }
    const tool = model.selectedTool;
    toolRig.visible = tool >= 0;
    plateTensionModels.forEach((wrench, index) => {
      wrench.visible = index === PLATE_SYMBOL_TO_WRENCH[tool];
    });
    const valid = tool >= 0 && tool === model.plates[model.selectedPlate].symbol;
    // Match the pin lock's side-keyway motion without scaling the tools or
    // moving them across the inspection window in front of the plates.
    const currentPlate = model.plates[model.selectedPlate];
    // Seven positions cover the same axial range as the existing seven-pin
    // cylinder (-1.43…0.37); the steel tip never travels beyond the plug.
    const chamberX = -.53 + (currentPlate.position - 4) * PLATE_HOLE_STEP;
    const pickTargetX = valid ? chamberX - .12 : -2.45;
    const currentPick = platePickRig.userData.dynamicBase || platePickRig.position;
    setDynamicBase(platePickRig, D(currentPick.x, pickTargetX, 9),
      coreCenterY, coreCenterZ);
    const currentTension = plateTensionRig.userData.dynamicBase || plateTensionRig.position;
    setDynamicBase(plateTensionRig, D(currentTension.x, valid ? -1.52 : -3.75, 9),
      coreCenterY + TENSION_TOOL_CLEARANCE.y, coreCenterZ + TENSION_TOOL_CLEARANCE.z);
  };
}
