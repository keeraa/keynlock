/** One controller state for all three locks; geometry remains in its own modules. */
export function createLockState(pinPositions) {
  return {
    mode: 'pin',
    insertTarget: 0, turnTarget: 0, unlockTarget: 0,
    wrong: false, picking: false, pinSetCount: 0,
    pinSet: pinPositions.map(() => false),
    pinLifts: pinPositions.map(() => 0),
    pinSequence: pinPositions.map((_, index) => index),
    pinWobble: 0, pinWobbleIndex: -1, pickPulse: 0,
    pickX: pinPositions[0], pickTargetX: pinPositions[0],
    insertP: 0, turnP: 0, unlockP: 0,
    explodeTarget: 0, explodeP: 0, transparency: 1,
    autoXray: false, schematicXray: false, finish: 'titanium', pinFinishIndex: 3,
    cartoonEnabled: true,
    toonEnabled: false, toonStrength: 80, toonBands: 4,
    outlineEnabled: true, cartoonOutline: 70, outlineWidth: 1,
    paintedMaterialsEnabled: true, paintStrength: 95, paintMaterial: 90, paintDetail: 2,
    paintSteelVariant: 'steel', paintBrassVariant: 'brass',
  };
}
