import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
  import { createGeometryPrimitives } from './geometry/primitives.js';
  import { createKeyGeometry } from './geometry/key.js';
  import { replaceKeyProfile } from './geometry/key-profile.js';
  import { resetLockMotion } from './gameplay/lock-state-transitions.js';
  import { createPinPuzzleRules } from './gameplay/pin-rules.js';
  import { createPinPuzzleController } from './gameplay/pin-controller.js';
  import { createFreePickingController } from './gameplay/free-picking.js';
  import { createGameActions } from './gameplay/actions.js';
  import { createWorldPuzzleEngine } from './gameplay/world-puzzles/engine.js';
  import { createWorldPuzzleStage } from './scene/world-puzzle-stage.js';
  import { attachWorldPuzzlePanel } from './ui/world-puzzle-panel.js';
  import { createLockAnimator } from './runtime/lock-animator.js';
  import { createSeededRandom, parseScenario } from './runtime/scenarios.js';
  import { createScenarioController } from './runtime/scenario-controller.js';
  import { createPinMotion, createDiscMotion, createCodeMotion, createPlateMotion } from './runtime/motions.js';
  import { createMechanismHandle, createMechanismRegistry } from './mechanisms/registry.js';
  import { createRustSystem } from './effects/rust.js';
  import { createCartoonFilter } from './effects/cartoon-filter.js';
  import { createFloatingParticles } from './effects/floating-particles.js';
  import { createPaintedMaterials } from './effects/painted-materials.js';
  import { modeDetails, pinPuzzleModes } from './gameplay/modes.js';
  import { buildPinMechanism } from './mechanisms/pin-lock.js';
  import { buildDiscMechanism } from './mechanisms/disc-lock.js';
  import { buildCodeMechanism } from './mechanisms/code-lock.js';
  import { buildPlateMechanism } from './mechanisms/plate-lock.js';
  import { createPlatePuzzle } from './gameplay/plate-rules.js';
  import { createPlatePanelUI } from './ui/plate-panel.js';
  import { createNotchedDisc as makeNotchedDisc, createSpurGear as makeSpurGear } from './geometry/lock-profiles.js';
  import { createLockState } from './state/lock-state.js';
  import { createLockSession } from './gameplay/lock-session.js';
  import { createLockPanelUI } from './ui/panels.js';
  import { createAppearanceActions } from './ui/appearance-actions.js';
  import { createPinFinishSwatches } from './ui/pin-finish-swatches.js';
  import { createPerformanceMonitor } from './performance/metrics.js';
  import { createLockStage } from './scene/lock-stage.js';
  import { createLockMaterials } from './effects/lock-materials.js';
  import { createOilCanPreview } from './geometry/oil-can.js';
  import { createHousingGeometries } from './geometry/housing.js';
  import { createScenePointerInteractions } from './ui/scene-pointer.js';
  import { createOilTool } from './tools/oil-tool.js';
  import { createLockHardware } from './mechanisms/lock-hardware.js';
  import { attachLockControls } from './ui/controls.js';
  import { attachSettingsTabs } from './ui/settings-tabs.js';
  import { createWrenchPickerPreview } from './ui/wrench-picker-preview.js';
  import { createLockDevtools } from './ui/devtools.js';

  const $ = (id) => document.getElementById(id);
  const canvas = $('viewport');
  const {scene,camera,renderer,controls}=createLockStage({
    THREE,OrbitControls,canvas,pixelRatio:devicePixelRatio,
  });
  const performanceMonitor=createPerformanceMonitor({
    enabled:new URLSearchParams(location.search).has('perf'),document,window,
  });
  const cartoonFilter=createCartoonFilter({THREE,renderer,scene,camera});
  const atmosphere=createFloatingParticles({THREE,scene,pixelRatio:renderer.getPixelRatio()});
  // Stable procedural roughness texture. Every finish uses the same micro-etched metal surface.
  const rng = createSeededRandom(parseScenario(window.location.search).seed);
  function rand() { return rng.next(); }
  const {grainMap,material,mat}=createLockMaterials({THREE,document,rand});

  const root = new THREE.Group();
  // The lock case is 30% shallower; internal moving parts keep their bearings.
  const depthRatio=.70;
  root.scale.z=depthRatio;
  root.rotation.y = -.09;
  scene.add(root);
  const parts = [];
  const raycastables = [];
  function tag(o, name, detail='') {
    o.userData.partName = name;
    o.userData.partDescription = detail;
    raycastables.push(o);
    return o;
  }
  function part(obj, dir, distance=1, name='', detail='') {
    const d = new THREE.Vector3(...dir).normalize();
    parts.push({obj,base:obj.position.clone(),dir:d,distance});
    if(name) tag(obj,name,detail);
    return obj;
  }
  function setDynamicBase(obj,x,y,z){
    let base=obj.userData.dynamicBase;
    if(!base){base=new THREE.Vector3();obj.userData.dynamicBase=base;}
    base.set(x,y,z);
    return base;
  }
  function addMesh(parent, geom, mt, pos=[0,0,0], name='', description='') {
    const m = new THREE.Mesh(geom,mt); m.position.set(...pos);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    if(name) tag(m,name,description);
    return m;
  }
  const { box, cyl, capsulePin, driverPin, ring, rod, moveArticulatedRod, moveTelescopicRod, makeSpring } =
    createGeometryPrimitives({ THREE, RoundedBoxGeometry, addMesh, setDynamicBase, springMaterial: mat.spring });
  const {oilPreviewScene,oilPreviewCamera,oilPreviewCan} =
    createOilCanPreview({THREE,document,rand,material,addMesh,cyl,box});
  const {createFrontBezel,createRearCover,createSideShell,createAnnularAxialGeometry,
    createKeywayPlugGeometry,createScrewThreadGeometry} =
    createHousingGeometries({THREE,depthRatio});


  const coreCenterY=-.43, coreCenterZ=-.05;
  const modeGroups={};
  const {inspectionWindow,shacklePivot,applyRigidShackleTransform,
    updateLockingBalls,shackleBody,restoreShackle,releaseShackle,stepShacklePhysics,
    lockCam,camEccentric,driveShaft,makeHousing}=createLockHardware({
      THREE,document,root,depthRatio,coreCenterY,coreCenterZ,mat,addMesh,tag,part,
      parts,raycastables,setDynamicBase,box,cyl,ring,rod,createRearCover,
      createSideShell,createFrontBezel,createAnnularAxialGeometry,createScrewThreadGeometry,
    });
  const {keyCutHeight,keySurfaceAt,makeKeyProfile,makeKey}=createKeyGeometry({
    THREE,getPinXs:()=>pinXs,coreCenterY,coreCenterZ,addMesh,mat,tag,rod,parts,
  });

  const createNotchedDisc = (...args) => makeNotchedDisc(THREE, ...args);
  const createSpurGear = (...args) => makeSpurGear(THREE, ...args);
  const pinMechanism = buildPinMechanism({ THREE, document, rand, grainMap, material, mat,
    root, depthRatio, tag, part, addMesh, box, cyl, ring, makeSpring, capsulePin,
    driverPin, createSpurGear, createKeywayPlugGeometry, makeHousing, keyCutHeight,
    makeKey, modeGroups, coreCenterY, coreCenterZ });
  const {
    raisedMechanism, pinGroup, pinHousing, keywayInsert, pinPlug, plugCutStart, plugCutEnd, plugSideReveal, plugSurface,
    pinFinishNames, pinTextureImages, pinTextures, pinStacks, makePinPositions,
    updatePlugCutawaySpan, pinStackRise, pinClearances, symbolGrooves, symbolBeam,
    makeManifoldGeometry, manifoldWalls, manifoldCap,
    pinGearDrive, pinGearOutput, pinDriveTeeth, pinOutputTeeth, pinDriveWheel, pinOutputWheel,
    pinEccentricRadius, pinSliderGuide, pinSlider, pinGearConnectingRod, pinCamConnectingRod,
    pinKey, pickRig, pickTip, handleRig, tensionSpecs, tensionRig, tensionModels,
  } = pinMechanism;
  let pinXs = pinMechanism.pinXs;
  let selectedTension = pinMechanism.selectedTension;
  const wrenchPreview=createWrenchPickerPreview({THREE,canvas,renderer,window,
    picker:$('wrenchPicker'),tensionModels,tensionSpecs});

  const discMechanism = buildDiscMechanism({ THREE, root, modeGroups, raisedMechanism, depthRatio, coreCenterY, coreCenterZ, makeHousing,
    makeKey, createNotchedDisc, addMesh, cyl, part, box, makeSpring, mat });
  const { discKey, detainerDiscs, sidebar } = discMechanism;

  const codeMechanism = buildCodeMechanism({ THREE, root, modeGroups, raisedMechanism, depthRatio, coreCenterY, coreCenterZ, makeHousing,
    createNotchedDisc, createSpurGear, addMesh, cyl, part, box, rod, ring, mat });
  const { codeDiscs, drive, fence, dialRig, gearA, gearB, teethA, teethB } = codeMechanism;
  const platePuzzle=createPlatePuzzle(rand);platePuzzle.reset();
  const plateMechanism=buildPlateMechanism({THREE,root,modeGroups,raisedMechanism,
    mat,addMesh,part,tag,box,ring,model:platePuzzle.model,depthRatio,
    pickRigTemplate:pickRig,tensionModelsTemplate:tensionModels,
    pinHousingTemplate:pinHousing,keywayInsertTemplate:keywayInsert,
    coreCenterY,coreCenterZ});

  // Rust progression and cloned materials are isolated from lock geometry.
  const { rustify, updateRustMaterial } = createRustSystem(THREE, rand);
  rustify(pinDriveWheel,.83);
  rustify(pinOutputWheel,.67);
  rustify(manifoldWalls,.52);
  rustify(pinSliderGuide,.74);
  rustify(gearA.children.find(o=>o.isMesh),.60);
  rustify(gearB.children.find(o=>o.isMesh),.72);
  rustify(detainerDiscs[1].children.find(o=>o.isMesh),.65);
  rustify(detainerDiscs[4].children.find(o=>o.isMesh),.54);

  const state=createLockState(pinXs);
  const gearBodies=[pinDriveWheel,pinOutputWheel,
    gearA.children.find(o=>o.isMesh),gearB.children.find(o=>o.isMesh)];
  const extraSurfaces=[...gearBodies.map(mesh=>({material:mesh.material,kind:'gear',mesh})),
    ...pinStacks.flatMap(st=>[st.pin,st.driver].map(mesh=>({material:mesh.material,kind:'pin'}))),
    ...[manifoldWalls,manifoldCap].map(mesh=>({material:mesh.material,kind:'manifold',mesh}))];
  const paintedMaterials=createPaintedMaterials({THREE,mat,document,extraSurfaces});
  let refreshPinPreviews=()=>{};
  const applyPaintedMaterials=()=>{
    paintedMaterials.setOptions({
      enabled:state.paintedMaterialsEnabled,textureStrength:state.paintStrength/100,
      materialStrength:state.paintMaterial/100,detail:state.paintDetail/100,
      steelVariant:state.paintSteelVariant,brassVariant:state.paintBrassVariant,
    });
    refreshPinPreviews(state.paintedMaterialsEnabled,state.paintStrength/100);
  };
  applyPaintedMaterials();
  const applyDrawingStyle=()=>cartoonFilter.setOptions({
    toon:state.toonEnabled,toonStrength:state.toonStrength/100,bands:state.toonBands,
    outline:state.outlineEnabled,outlineStrength:state.cartoonOutline/100,
    outlineWidth:state.outlineWidth,
  });
  applyDrawingStyle();
  let gameActions;
  function dispatchGame(command,meta){return gameActions.dispatch(command,meta);}
  const platePanel=createPlatePanelUI({document,$,puzzle:platePuzzle});
  let pinPuzzle=null;
  function status(message){$('status').textContent=message;}
  const pinFinishPicker=createPinFinishSwatches({document,container:$('pinFinishSwatches'),
    names:pinFinishNames,originalImages:pinTextureImages});
  const pinFinishButtons=pinFinishPicker.buttons;
  refreshPinPreviews=pinFinishPicker.update;
  refreshPinPreviews(state.paintedMaterialsEnabled,state.paintStrength/100);
  function setPinFinish(index){
    state.pinFinishIndex=index;
    pinStacks.forEach(st=>{
      st.pin.userData.partDescription=`Нижний кодовый штифт · ${pinFinishNames[index]}.`;
      st.driver.userData.partDescription=`Верхний запирающий штифт · ${pinFinishNames[index]}.`;
    });
    paintedMaterials.setPinBaseTexture(pinTextures[index],index);
    $('pinFinishValue').textContent=pinFinishNames[index];
    pinFinishButtons.forEach((button,i)=>{
      const active=i===index;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }
  function setPinCount(count){
    const next=THREE.MathUtils.clamp(Math.round(Number(count)),4,6);
    if(next===pinXs.length)return;
    pinXs=makePinPositions(next);
    updatePlugCutawaySpan(pinXs);
    for(const st of pinStacks){
      st.stack.visible=st.i<next;
      st.stack.position.x=pinXs[st.i]??0;
      // Exploded transforms follow the rebuilt mechanism as well.
      const descriptor=parts.find(p=>p.obj===st.stack);
      if(descriptor)descriptor.base.x=st.stack.position.x;
    }
    const oldGeometry=manifoldWalls.geometry;
    manifoldWalls.geometry=makeManifoldGeometry(pinXs);
    oldGeometry.dispose();
    if(!pinPuzzle){
      for(const button of document.querySelectorAll('#pinPuzzleLevels button')){
        const active=Number(button.dataset.level)===next-3;
        button.classList.toggle('active',active);
        button.setAttribute('aria-pressed',String(active));
      }
    }
    modeDetails.pin.description=`${next} ${next===4?'пары':'пар'} штифтов и пружины. A/D или ←/→ — соседний штифт; W или ↑ — поднять.`;
    if(state.mode==='pin'&&!pinPuzzle)$('modeDescription').textContent=modeDetails.pin.description;
    resetLockMotion(state);
    restoreShackle();resetPicking();
    replaceKeyProfile(pinKey,makeKeyProfile);
    status(`Штифтовых пар: ${next}. Каналы перестроены, допуски сохранены.`);
    updateButtons();
  }
  const { pinPuzzleSymbols, puzzleRandom, puzzleShuffle, puzzleConnections, puzzleLinkedStep,
    puzzleGenerate, puzzleReady, puzzleActiveIndex, puzzlePinLift } =
    createPinPuzzleRules({ THREE, rand, getPuzzle: () => pinPuzzle });
  const {resetPicking,nearestPin,pinsAtShear,attemptPick}=createFreePickingController({
    state,getPinXs:()=>pinXs,pinClearances,pinStacks,getPinPuzzle:()=>pinPuzzle,
    puzzleReady,pinPuzzleAction:()=>pinPuzzleAction(),setPinFinish,status,
    updateButtons:()=>updateButtons(),
  });
  const {startPinPuzzle,puzzleSelectPin,puzzleAdjust,puzzleSetSlider,puzzleComplete,
    pinPuzzleAction,tickPinPuzzle,puzzleNotice,puzzleDamage}=createPinPuzzleController({
    THREE,$,document,performance,state,modeDetails,pinPuzzleModes,
    getPuzzle:()=>pinPuzzle,setPuzzle:value=>{pinPuzzle=value;},getPinXs:()=>pinXs,
    setPinCount,pinKey,pickRig,tensionRig,makeKeyProfile,restoreShackle,resetPicking,
    status,rand,pinPuzzleSymbols,puzzleRandom,puzzleLinkedStep,puzzleGenerate,
    puzzleReady,puzzleActiveIndex,
    renderPuzzle:(...args)=>renderPinPuzzleUI(...args),
    updateControls:()=>updateButtons(),setMode,attemptShackleOpen,
  });
  const { renderPinPuzzleUI, updateButtons } = createLockPanelUI({
    $, state, getPuzzle: () => pinPuzzle, getPinXs: () => pinXs,
    pinPuzzleModes, pinPuzzleSymbols, puzzleActiveIndex, puzzleReady, shackleBody,
  });
  const mechanismRegistry=createMechanismRegistry({
    pin:createMechanismHandle({name:'pin',model:pinMechanism,group:modeGroups.pin,
      update:createPinMotion({THREE,state,pinPlug,pinKey,pickRig,pickTip,handleRig,
        tensionRig,discKey,setDynamicBase,coreCenterY,coreCenterZ,symbolBeam,
        symbolGrooves,pinStacks,keySurfaceAt,puzzlePinLift,pinStackRise,
        pinGearDrive,pinGearOutput,pinDriveTeeth,pinOutputTeeth,pinEccentricRadius,
        pinSlider,moveArticulatedRod,pinGearConnectingRod,camEccentric,pinGroup,
        moveTelescopicRod,pinCamConnectingRod})}),
    disc:createMechanismHandle({name:'disc',model:discMechanism,group:modeGroups.disc,
      update:createDiscMotion({state,discKey,detainerDiscs,sidebar,setDynamicBase})}),
    code:createMechanismHandle({name:'code',model:codeMechanism,group:modeGroups.code,
      update:createCodeMotion({state,codeDiscs,drive,dialRig,fence,gearA,gearB,
        teethA,teethB,setDynamicBase})}),
    plate:createMechanismHandle({name:'plate',model:plateMechanism,group:modeGroups.plate,
      update:createPlateMotion({...plateMechanism,setDynamicBase})}),
  });
  const lockSession=createLockSession({$,document,state,modeDetails,mechanismRegistry,
    getPinPuzzle:()=>pinPuzzle,setPinPuzzle:value=>{pinPuzzle=value;},getPinXs:()=>pinXs,
    pinKey,pickRig,tensionRig,makeKeyProfile,restoreShackle,resetPicking,status,
    startPinPuzzle,renderPinPuzzleUI,updateButtons,shackleBody,puzzleReady,
    puzzleNotice,puzzleDamage,puzzleComplete,platePuzzle,renderPlateUI:platePanel.render,
    getSelectedTension:()=>selectedTension});
  function setMode(mode){lockSession.setMode(mode);}
  function reset(){lockSession.reset();}
  function attemptShackleOpen(){lockSession.attemptShackleOpen();}
  const {raycaster,pointer,tooltip,isVisibleTree,cancelPointerClick} =
    createScenePointerInteractions({THREE,$,canvas,camera,raycastables,inspectionWindow,
      mat,plugSurface,plugSideReveal,plugCutStart,plugCutEnd,getPinPuzzle:()=>pinPuzzle,
      getPinXs:()=>pinXs,pinStacks,state,dispatch:dispatchGame,shacklePivot,status,window});
  const {tickOil,updateOilPreviewViewport,renderOilToolPreview,setRenderSize,toggleOilTool} =
    createOilTool({THREE,scene,root,canvas,camera,renderer,document,window,$,mat,
      pointer,raycaster,isVisibleTree,inspectionWindow,plugSurface,plugSideReveal,
      plugCutStart,plugCutEnd,rand,updateRustMaterial,status,tooltip,cancelPointerClick,
      oilPreviewScene,oilPreviewCamera,oilPreviewCan,dispatch:dispatchGame});
  const applyAppearanceAction=createAppearanceActions({$,document,state,mat,status,
    getPinXs:()=>pinXs,setPinFinish,applyPaintedMaterials,
    setBaseCaseRoughness:value=>paintedMaterials.setBaseCaseRoughness(value),
    applyDrawingStyle});
  const worldPuzzles=createWorldPuzzleEngine({storage:window.localStorage,
    seed:parseScenario(window.location.search).seed});
  gameActions=createGameActions({THREE,document,state,setMode,setPinCount,startPinPuzzle,
    puzzleAdjust,pinPuzzleAction,puzzleSetSlider,updateButtons,resetPicking,shackleBody,
    reset,attemptShackleOpen,restoreShackle,pinKey,pickRig,tensionRig,makeKeyProfile,
    status,tensionModels,tensionSpecs,getPinPuzzle:()=>pinPuzzle,getPinXs:()=>pinXs,
    setSelectedTension:index=>{selectedTension=index;},attemptPick,puzzleSelectPin,
    nearestPin,applyAppearanceAction,toggleOilTool,platePuzzle,renderPlateUI:platePanel.render,
    worldPuzzles});
  attachLockControls({$,document,state,getPinPuzzle:()=>pinPuzzle,
    getPlatePuzzle:()=>platePuzzle.model,dispatch:dispatchGame});
  const settingsTabs=attachSettingsTabs({document,rail:document.querySelector('.right-rail'),
    onUserActivate:name=>{
      if(name==='lock'&&worldPuzzles.getSnapshot().active)
        dispatchGame({type:'world-exit'},{source:'ui'});
    }});
  const worldStage=createWorldPuzzleStage({THREE,RoundedBoxGeometry,document,scene,camera,
    controls,canvas,root,materials:mat,dispatch:dispatchGame});
  let worldSceneActive=false;
  worldPuzzles.subscribe(snapshot=>{worldSceneActive=snapshot.active;worldStage.sync(snapshot);});
  worldStage.sync(worldPuzzles.getSnapshot());
  attachWorldPuzzlePanel({document,$,engine:worldPuzzles,dispatch:dispatchGame,tabs:settingsTabs});
  const scenarioController=createScenarioController({window,document,camera,controls,
    rng,state,getPinXs:()=>pinXs,getPinPuzzle:()=>pinPuzzle,dispatch:dispatchGame});
  const devtools=createLockDevtools({THREE,window,document,root,scene,state,
    scenarioController,getPinXs:()=>pinXs,getPinPuzzle:()=>pinPuzzle,pinStacks,pinGroup,
    pinShearY:pinMechanism.pinShearY,coreCenterZ,pinGearDrive,pinGearOutput,shackleBody,
    gameActions});
  const {animate}=createLockAnimator({
    THREE,performance,state,tickPinPuzzle,pinsAtShear,mechanismRegistry,
    driveShaft,getPinXs:()=>pinXs,getPinPuzzle:()=>pinPuzzle,
    getSelectedTension:()=>selectedTension,lockCam,updateLockingBalls,shackleBody,
    shacklePivot,releaseShackle,stepShacklePhysics,applyRigidShackleTransform,
    parts,tickOil,tickAtmosphere:atmosphere.update,plugSideReveal,
    controls,mat,$,updateButtons,renderPinPuzzleUI,renderer,scene,camera,
    performanceMonitor,
    renderOilToolPreview:now=>worldSceneActive?null:renderOilToolPreview(now),
    status,tickDebug:devtools.tick,
    renderWrenchPickerPreview:now=>worldSceneActive?null:wrenchPreview.renderWrenchPickerPreview(now),
    renderScene:cartoonFilter.render,tickWorld:worldPuzzles.tick,
  });
  renderer.setAnimationLoop(animate);
  const resize=()=>{
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    setRenderSize(w,h);
    wrenchPreview.setRenderSize(w,h);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    cartoonFilter.resize(w,h);
    updateOilPreviewViewport();
    wrenchPreview.updateWrenchPickerViewport();
  };
  new ResizeObserver(resize).observe(canvas);resize();
  new ResizeObserver(updateOilPreviewViewport).observe($('oilToolButton'));
  new ResizeObserver(wrenchPreview.updateWrenchPickerViewport).observe($('wrenchPicker'));
  setMode('pin');
  scenarioController.loadFromUrl();
  requestAnimationFrame(()=>$('loading').classList.add('done'));
