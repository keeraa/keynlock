/** Mode-specific motion stays with its mechanism, outside the common render loop. */
import { TENSION_TOOL_CLEARANCE } from '../mechanisms/pin-tools.js';
export { createPlateMotion } from './plate-motion.js';

export function createPinMotion({
  THREE, state, pinPlug, pinKey, pickRig, pickTip, handleRig, tensionRig,
  discKey, setDynamicBase, coreCenterY, coreCenterZ, symbolBeam, symbolGrooves,
  pinStacks, keySurfaceAt, puzzlePinLift, pinStackRise,
  pinGearDrive, pinGearOutput, pinDriveTeeth, pinOutputTeeth,
  pinEccentricRadius, pinSlider, moveArticulatedRod, pinGearConnectingRod,
  camEccentric, pinGroup, moveTelescopicRod, pinCamConnectingRod,
}) {
  const crankPoint = new THREE.Vector3(), sliderPoint = new THREE.Vector3();
  const linkStart = new THREE.Vector3(), linkEnd = new THREE.Vector3();
  const linkDirection = new THREE.Vector3();
  const camPoint = new THREE.Vector3();
  return ({ D, canRotate, fullTurn, pinXs, pinPuzzle, selectedTension }) => {
    // The inserted tension wrench applies a tiny preload against the first
    // binding driver, limited by the clearances until all pins are set.
    const preload=state.picking&&state.insertP>.92&&!canRotate?
      .009+selectedTension*.001:0;
    const plugAngle=fullTurn+preload;
    pinPlug.rotation.x=plugAngle;
    pinKey.rig.rotation.x=fullTurn;
    setDynamicBase(pinKey.rig,-2.45*(1-state.insertP),coreCenterY,coreCenterZ);
    pickRig.rotation.x=plugAngle;
    // Lever around the picking tip: the handle descends as the pin is lifted.
    // Both parts remain one rigid assembly without a gap at their joint.
    pickRig.rotation.z=state.pickPulse*.035;
    pickTip.position.y=0;
    handleRig.position.y=-.19;
    state.pickX=D(state.pickX,state.pickTargetX,10);
    setDynamicBase(pickRig,
      -2.45*(1-state.insertP)+(state.pickX-.12)*state.insertP,
      coreCenterY+state.pickPulse*.020,coreCenterZ);
    // The secondary wrench enters beside the pick and stays against the
    // keyway while the pick moves between the selected pin chambers.
    tensionRig.rotation.x=plugAngle;
    setDynamicBase(tensionRig,
      -3.75*(1-state.insertP)-1.52*state.insertP,
      coreCenterY+TENSION_TOOL_CLEARANCE.y,coreCenterZ+TENSION_TOOL_CLEARANCE.z);
    setDynamicBase(discKey.rig,-2.45*(1-state.insertP),coreCenterY,coreCenterZ);
    const symbolsActive=pinPuzzle?.type==='symbolpins';
    symbolBeam.visible=symbolsActive;
    if(symbolsActive){
      symbolBeam.position.x=(pinXs[0]+pinXs[pinXs.length-1])*.5;
      symbolBeam.scale.y=(pinXs[pinXs.length-1]-pinXs[0]+.22)/2.02;
    }
    for(const st of pinStacks){
      symbolGrooves[st.i].visible=symbolsActive&&st.i<pinXs.length;
      if(st.i>=pinXs.length)continue;
      state.pinLifts[st.i]=D(state.pinLifts[st.i],state.pinSet[st.i]?1:0,6.2);
      const keyX=pinXs[st.i]+2.45*(1-state.insertP);
      const surface=keySurfaceAt(keyX,state.wrong);
      const keyLift=surface===null?0:Math.max(0,coreCenterY+surface-st.restBottom);
      const rejectedLift=state.pinWobbleIndex===st.i?state.pinWobble*.060:0;
      const targetLift=pinPuzzle?puzzlePinLift(st):state.picking?
        st.requiredLift*state.pinLifts[st.i]+rejectedLift:keyLift;
      st.lift=D(st.lift,targetLift,12);
      // The lower pin follows the plug only after the two pin faces meet
      // at the shear line. The driver and its spring stay in the fixed shell.
      const keyPinCenter=st.restBottom+st.lift+st.keyLength*.5;
      const radialY=keyPinCenter-coreCenterY;
      st.pin.position.set(0,coreCenterY+radialY*Math.cos(plugAngle)-pinStackRise,
        coreCenterZ+radialY*Math.sin(plugAngle));
      st.pin.rotation.x=plugAngle;
      st.driver.position.y=st.restBottom+st.lift+st.keyLength+
        st.driverLength*.5-pinStackRise;
      const driverTop=.145+st.lift;
      const springBottom=driverTop+.021;
      const near=state.picking&&Math.abs(state.pickX-pinXs[st.i])<.11;
      const glow=state.pinWobbleIndex===st.i&&state.pinWobble>.12?
        0x45100a:near&&!(pinPuzzle?pinPuzzle.fixed[st.i]:state.pinSet[st.i])?0x32200e:0x000000;
      st.pin.material.emissive.setHex(glow);
      st.driver.material.emissive.setHex(glow);
      const springTop=.945; // Upper coils enter the bored socket above the chamber.
      st.spring.position.y=springBottom;
      st.spring.scale.y=Math.max(.10,springTop-springBottom);
    }
    // The gear follower responds to actual pin travel, rather than a jump
    // in the counter when a user confirms a pin.
    let pinTravel=0;
    for(const st of pinStacks){
      if(st.i<pinXs.length)pinTravel+=Math.min(1.25,st.lift/Math.max(.01,st.requiredLift));
    }
    const gearTurn=pinTravel*.52+state.turnP*1.80+state.unlockP*.30;
    pinGearDrive.rotation.z=gearTurn;
    pinGearOutput.rotation.z=-gearTurn*(pinDriveTeeth/pinOutputTeeth)+Math.PI/pinOutputTeeth;
    const crankAngle=pinGearOutput.rotation.z;
    crankPoint.set(
      pinGearOutput.position.x+pinEccentricRadius*Math.cos(crankAngle),
      pinGearOutput.position.y+pinEccentricRadius*Math.sin(crankAngle),
      pinGearOutput.position.z+.26
    );
    const sliderX=1.17,linkLength=.445;
    const horizontal=sliderX-crankPoint.x;
    const sliderY=crankPoint.y-Math.sqrt(Math.max(.005,linkLength*linkLength-horizontal*horizontal));
    sliderPoint.set(sliderX,sliderY,-.12);
    setDynamicBase(pinSlider,sliderX,sliderY,-.29);
    linkDirection.subVectors(sliderPoint,crankPoint).normalize();
    linkStart.copy(crankPoint).addScaledVector(linkDirection,.076);
    linkEnd.copy(sliderPoint).addScaledVector(linkDirection,-.076);
    moveArticulatedRod(pinGearConnectingRod,linkStart,linkEnd);
    // Cross from the cam's root-space frame into the raised pin assembly.
    // This also respects the lock's non-uniform depth scale and exploded view.
    camEccentric.getWorldPosition(camPoint);
    pinGroup.worldToLocal(camPoint);
    moveTelescopicRod(pinCamConnectingRod,sliderPoint,camPoint);
  };
}

export function createDiscMotion({ state, discKey, detainerDiscs, sidebar, setDynamicBase }) {
  const discStartAngles=[-.92,.52,-.64,1.14,-1.37,.76];
  return () => {
    discKey.rig.rotation.x=state.turnP*.52;
    detainerDiscs.forEach((g,i)=>{
      g.rotation.x=discStartAngles[i]*(1-state.insertP);
    });
    setDynamicBase(sidebar,-.42,-.055-state.turnP*.10,.11);
  };
}

export function createCodeMotion({ state, codeDiscs, drive, dialRig, fence,
  gearA, gearB, teethA, teethB, setDynamicBase }) {
  const codeStartAngles=[-1.02,.76,-.47];
  return () => {
    codeDiscs.forEach((g,i)=>{
      g.rotation.x=codeStartAngles[i]*(1-state.insertP);
    });
    drive.rotation.x=state.turnP*.75;
    dialRig.rotation.x=state.insertP*Math.PI*5+state.turnP*.72;
    setDynamicBase(fence,-.26,-.02-state.turnP*.10,.02);
    gearA.rotation.z=state.insertP*2.0+state.turnP*1.4;
    gearB.rotation.z=-(state.insertP*2.0+state.turnP*1.4)*(teethA/teethB)+Math.PI/teethB;
  };
}

