// Frame-by-frame movement, camera-dependent display, and WebGL presentation.
import {setInspectionWindowOpacity, SCHEMATIC_XRAY_TRANSPARENCY} from '../effects/inspection-window.js';
import {combineFrameStats} from '../performance/metrics.js';
export const EXPLODE_DISTANCE_MULTIPLIER = 2.85;
export function createLockAnimator({
  THREE, performance, state, tickPinPuzzle, pinsAtShear, mechanismRegistry,
  driveShaft, getPinXs, getPinPuzzle, getSelectedTension, lockCam, updateLockingBalls,
  shackleBody, shacklePivot, releaseShackle, stepShacklePhysics,
  applyRigidShackleTransform,
  parts, tickOil, tickAtmosphere, plugSideReveal, controls, mat, $, updateButtons,
  renderPinPuzzleUI, renderer, scene, camera, performanceMonitor,
  renderOilToolPreview, renderWrenchPickerPreview = () => {}, status, tickDebug = () => {},
  tickWorld = () => {}, renderScene,
}) {
  function smooth(value,min,max){const t=THREE.MathUtils.clamp((value-min)/(max-min),0,1);return t*t*(3-2*t);}
  const dummy=new THREE.Vector3();
  const pivotPosition=new THREE.Vector3();
  let previousTime=performance.now(),lastStatsUpdate=previousTime,statsFrames=0,lastButtonsUpdate=0;
  function animate(){
    // Active lock parameters may change when the player changes modes or pin count.
    const pinPuzzle=getPinPuzzle();
    const pinXs=getPinXs();
    const selectedTension=getSelectedTension();
    const now=performance.now();
    const dt=Math.min((now-previousTime)/1000,.04);
    previousTime=now;
    const D=(from,to,speed=5)=>THREE.MathUtils.damp(from,to,speed,dt);
    state.insertP=D(state.insertP,state.insertTarget,3.25);
    tickPinPuzzle(dt);
    tickWorld(dt);
    const canRotate=state.mode!=='pin'||pinsAtShear();
    state.turnP=D(state.turnP,canRotate?state.turnTarget:0,state.turnTarget?2:4);
    state.unlockP=D(state.unlockP,canRotate?state.unlockTarget:0,state.unlockTarget?3.5:4.2);
    state.explodeP=D(state.explodeP,state.explodeTarget,3.2);
    state.pickPulse=D(state.pickPulse,0,7.2);
    state.pinWobble=D(state.pinWobble,0,10);
    shackleBody.shaking=D(shackleBody.shaking,0,4.2);

    // Every lock uses the same frame clock and a mode-specific motion adapter.
    const fullTurn=state.turnP*.62;
    driveShaft.rotation.x=fullTurn;
    lockCam.rotation.x=fullTurn;
    mechanismRegistry.update({ D, canRotate, fullTurn, pinXs, pinPuzzle, selectedTension });
    // Cam/follower/ball catch are mechanically coupled to the unlock phase.
    const latchReleased=smooth(Math.abs(lockCam.rotation.x),.015,.20);
    updateLockingBalls(latchReleased);
    // Unlock animation releases the complete U-shaped shackle. After the legs
    // leave their bores, the body falls under gravity with rigid collisions.
    const drawnOut=smooth(state.unlockP,.19,.65);
    const swungOpen=smooth(state.unlockP,.67,.99);
    if(!shackleBody.released){
      const jiggle=shackleBody.shaking;
      pivotPosition.set(
        1.52+.86*drawnOut+.016*jiggle*Math.sin(now*.020),
        -.64-.18*swungOpen+.007*jiggle*Math.cos(now*.024),.025);
      const angle=-.82*swungOpen+.029*jiggle*Math.sin(now*.019);
      shacklePivot.userData.dynamicBase=pivotPosition;
      shacklePivot.rotation.set(0,0,angle);
      // The legs have cleared both collars once drawnOut reaches 1 at .65.
      if(state.unlockTarget&&state.unlockP>.82){
        releaseShackle(pivotPosition,angle);
        status('Дужка свободна: падение, отскок и трение о поверхность');
      }
    }
    stepShacklePhysics(dt);

    // Assembly is non-destructive: each part always returns to its saved rest transform.
    for(const p of parts){
      const base=p.obj.userData.dynamicBase || p.base;
      const screw=p.obj.userData.unscrew;
      let release=state.explodeP;
      if(screw){
        release=smooth(state.explodeP,screw.delay,1);
        const axialTravel=p.distance*release*EXPLODE_DISTANCE_MULTIPLIER;
        // Each revolution advances the screw by one thread pitch. Once clear
        // of the housing it can fly farther without gratuitous spinning.
        p.obj.rotation.z=screw.baseAngle+
          Math.PI*2*Math.min(axialTravel,screw.threadedLength)/screw.pitch;
      }else if(p.obj.userData.explodeDelay!==undefined){
        release=smooth(state.explodeP,p.obj.userData.explodeDelay,1);
      }
      dummy.copy(p.dir).multiplyScalar(p.distance*release*EXPLODE_DISTANCE_MULTIPLIER);
      p.obj.position.copy(base).add(dummy);
    }
    // Put depth compensation before world rotation to retain circular ends.
    applyRigidShackleTransform();
    tickOil(dt);
    tickAtmosphere(dt);
    // Show exposed pin bodies in a profile view by fading the axial plug
    // only between the first and last pin; preserve its metal ends.
    plugSideReveal.value=.98*smooth(Math.abs(Math.cos(controls.getAzimuthalAngle())),.38,.78);
    // Auto mode takes full control of the front wall. At the front the
    // mechanism is visible; when rotated sideways, the shell reappears.
    const angle=Math.abs(controls.getAzimuthalAngle());
    const xray=state.schematicXray?SCHEMATIC_XRAY_TRANSPARENCY:state.autoXray?
      1-.84*smooth(angle,.38,1.30):state.transparency;
    // At 0% transparency the wall is a REAL opaque occluder in both the
    // color and normal/depth passes: outlines behind it must disappear.
    setInspectionWindowOpacity(mat.glass,1-xray);
    if(state.autoXray&&!state.schematicXray){
      const readout=`Авто · ${Math.round(xray*100)}%`;
      if($('opacityValue').textContent!==readout)$('opacityValue').textContent=readout;
    }
    controls.update();
    if(now-lastButtonsUpdate>100){
      updateButtons();if(pinPuzzle)renderPinPuzzleUI();
      lastButtonsUpdate=now;
    }
    tickDebug();
    const sceneStats=renderScene ? renderScene() : (renderer.render(scene,camera),{...renderer.info?.render});
    const sceneTriangles=sceneStats?.sceneTriangles ?? sceneStats?.triangles;
    const oilStats=renderOilToolPreview(now);
    const wrenchStats=renderWrenchPickerPreview(now);
    // Count the WebGL scissor previews too; preserve the main scene-only polygon counter.
    performanceMonitor.record(now,combineFrameStats(sceneStats,oilStats,wrenchStats),renderer.info?.memory);
    statsFrames++;
    if(now-lastStatsUpdate>500){
      if(Number.isFinite(sceneTriangles))$('polygonCount').textContent=sceneTriangles.toLocaleString('ru-RU');
      $('fpsCount').textContent=Math.round(statsFrames*1000/(now-lastStatsUpdate)).toLocaleString('ru-RU');
      statsFrames=0;lastStatsUpdate=now;
    }
  }
  return {animate};
}
