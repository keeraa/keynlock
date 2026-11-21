import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINAL_STATIONS } from '../src/original-stations.js';
import { REAGENTS, emptyMixture, addDose } from '@keynlock/alchemy/src/mixing.js';
import { generateRecipe, evaluateRecipe } from '@keynlock/alchemy/src/recipes.js';
import { assistedFilingStroke, cutLayout, generateBlueprint,
  inspectKey, keyTopOutline, targetGuideSegments } from '../public/stations/workbench/js/logic.js';

test('all three original alchemy difficulties can achieve perfect scores on the shared table',()=>{
  for(const level of [1,2,3]){
    const recipe=generateRecipe(REAGENTS,()=>.27,37+level,level);
    const mixture=emptyMixture(), timeline=[];
    for(const stage of recipe.stages){
      for(const ingredient of stage.ingredients){
        const reagent=REAGENTS.find(entry=>entry.id===ingredient.id);
        const added=addDose(mixture,reagent,reagent.dose*ingredient.count);
        assert.equal(added,reagent.dose*ingredient.count);
        timeline.push({kind:'add',id:reagent.id,amount:added});
      }
      timeline.push({kind:'heat',seconds:stage.heatSeconds});
    }
    const result=evaluateRecipe(recipe,mixture,recipe.heatSeconds,REAGENTS,timeline);
    assert.equal(result.score,100,`level ${level} retains the original recipe evaluation`);
  }
});

test('workbench geometry and key inspection reuse the exact source cutting rules',()=>{
  for(const count of [4,6,8]){
    const blueprint=generateBlueprint(count,'',()=>.36);
    const cuts=Array(count).fill(0);
    const layout=cutLayout(count);
    assert.equal(layout.length,count);
    for(let i=0;i<cuts.length;i++){
      cuts[i]=assistedFilingStroke(0,blueprint.targets[i]*1800,blueprint.targets[i]);
      if(cuts[i]!==blueprint.targets[i])cuts[i]=blueprint.targets[i];
    }
    assert.equal(inspectKey(cuts,blueprint.targets).accurate,true);
    assert.ok(keyTopOutline(cuts,layout).length>count*2);
    assert.ok(Array.isArray(targetGuideSegments(cuts,blueprint.targets,layout)));
  }
});

test('restoration edits the original artwork in-room; remaining stations retain source integrations',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const transitions = readFileSync(new URL('../src/zone-transitions.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/restoration-view.js', import.meta.url), 'utf8');
  const source=readFileSync(new URL('../src/original-stations.js',import.meta.url),'utf8');
  const nativeAtelier=readFileSync(new URL('../src/atelier-in-room.js',import.meta.url),'utf8');
  const bridge=readFileSync(new URL('../src/shared-renderer-host.js',import.meta.url),'utf8');
  assert.equal((html.match(/<canvas\s+id="scene"/g)||[]).length,1);
  assert.ok(html.includes('id="scene-interaction"'),'a stable input layer covers the 3D scene');
  assert.ok(html.includes('id="original-station-frame"'),'original app preserves its full DOM');
  assert.ok(transitions.includes('originalStations.preload(id)'),'original app is prepared when its zone is clicked');
  assert.ok(transitions.includes("if (currentZone === 'alchemy') camera.lookAt(controls.target)"),
    'alchemy camera flight must rotate toward the table even while OrbitControls is paused');
  assert.ok(transitions.includes("camera.position.distanceTo(desiredPosition) < alchemyApproachDistance * .55")
    && main.includes('!overlayOpen || zoneTransitions.isTransitioning()'),
    'the laboratory activates during the camera approach while the room keeps rendering');
  assert.ok(transitions.includes("setInRoomWorkshop(id === 'restoration' ? id : null)"),
    'original Atelier workbench controls are shown in the Lair itself');
  assert.ok(main.includes('mountAtelierInRoom()')
    && nativeAtelier.includes("document.querySelector('#app').appendChild(atelier)"),
    'the exact original Atelier DOM is mounted into the Lair document');
  assert.ok(nativeAtelier.includes("import('@keynlock/atelier/src/main.js')"),
    'the original Atelier source runs directly in the Lair page');
  assert.ok(source.includes("if (id === 'restoration' || id === 'alchemy') return;")
    && !source.includes("ensureFrame('restoration')"),
    'alchemy and restoration activate their original in-room integrations');
  const nativeAlchemy=readFileSync(new URL('../src/alchemy-in-room.js',import.meta.url),'utf8');
  assert.ok(main.includes('mountAlchemyInRoom()')
    && nativeAlchemy.includes("import('@keynlock/alchemy/src/alchemy.js')"),
    'the original alchemical laboratory mounts directly inside the Lair');
  assert.ok(!main.includes('connectAtelier('),
    'the obsolete cross-origin hidden atelier iframe is not loaded');
  assert.ok(!main.includes('originalStations.preloadAll()'),
    'unvisited workshops do not start detached documents during Lair startup');
  assert.ok(!html.includes('id="restoration-dock"'),
    'no replacement tools or imitation painting panel are created');
  assert.ok(transitions.includes('controls.minAzimuthAngle = -Infinity'),
    'free orbiting remains possible at every viewpoint');
  assert.ok(main.includes('new OrbitControls(camera, interaction)')
    && main.includes('controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE')
    && main.includes('controls.enableRotate = true'),
  'the camera rotates when dragging the dedicated scene interaction layer');
  assert.ok(main.includes("interaction.addEventListener('pointermove', hover3D)"),
    'room hit testing and camera events use the same input surface');
  assert.ok(main.includes('buildLair(scene, materials)')
    && !readFileSync(new URL('../src/room.js',import.meta.url),'utf8').includes('restoration-easel'),
    'the room never builds mock restoration easels next to the source easels');
  assert.ok(transitions.includes("scene.getObjectByName('atelier-original-wallpaper')")
    && transitions.includes('atelierWall.visible = false')
    && !transitions.includes('lairWall.material = atelierWall.material'),
    'the Lair keeps its independently loaded original gouache wallpaper instead of an unfinished Atelier placeholder');
  assert.ok(!transitions.includes("originalStations.open(workspace)"),
    'the old portal/iframe workspace swap no longer drives Atelier transitions');
  const atelierMain=readFileSync(new URL('../../../workshops/atelier/src/main.js',import.meta.url),'utf8');
  assert.ok(atelierMain.includes('isInteractive: isRestorationActive')
    && atelierMain.includes("registerWorldWorkshop('restoration'"),
    'the painting tools receive the parent canvas pointer only while restoration is active');
  const atelierInput=readFileSync(new URL('../../../workshops/atelier/src/restoration-input.js',import.meta.url),'utf8');
  const atelierMarkup=readFileSync(new URL('../../../workshops/atelier/index.html',import.meta.url),'utf8');
  const atelierUI=readFileSync(new URL('../../../workshops/atelier/src/workshop-ui.js',import.meta.url),'utf8');
  const atelierCss=readFileSync(new URL('../../../workshops/atelier/src/style.css',import.meta.url),'utf8');
  const atelierFilter=readFileSync(new URL('../../../workshops/atelier/src/effects/cartoon-filter.js',import.meta.url),'utf8');
  assert.ok(atelierMain.includes('window.__keynlockRestorationBridge'),
    'the Lair uses the original painting sessions and operations');
  assert.ok(atelierMain.includes('lairWindow.__keynlockLairInteractionElement'),
    'original paint brushes share the active scene input surface with camera controls');
  assert.ok(atelierInput.includes('inputElement.addEventListener'),
    'original brush and UV operations listen on the shared canvas');
  for (const tool of ['brush','uv','reagent','swab','retouch'])
    assert.ok(atelierMarkup.includes(`data-tool="${tool}"`),`the original ${tool} control is mounted`);
  assert.ok(atelierInput.includes("button.addEventListener('click', () => selectTool(button.dataset.tool))"),
    'the mounted original buttons are bound to functional paint operations');
  assert.ok(nativeAtelier.includes("feedback.append(atelier.querySelector('#restoration-cursor')")
    && atelierMain.includes('stage: embedded ? lairWindow.__keynlockLairInteractionElement : stage'),
    'painting cursor and damage hints follow the actual shared canvas');
  assert.ok(atelierMain.includes('onPaintingFocus: embedded ? focusLairArtwork')
    && view.includes('window.__keynlockLairFocusArtwork'),
    'clicks on the original artwork focus the visible Lair camera');
  assert.ok(atelierMain.includes('roomControls: embedded ? lairWindow.__keynlockLairControls')
    && atelierInput.includes('roomControls.enabled = false')
    && atelierInput.includes('roomControls.enabled = true'),
    'brush strokes temporarily pause the room orbit and restore it afterward');
  assert.ok(atelierUI.includes('if (!isEnabled()) return;'),
    'keyboard shortcuts cannot hijack the room outside restoration mode');
  assert.ok(atelierMain.includes("notifyLair('models-ready')"),
    'the original 3D meshes signal readiness before all artwork images download');
  assert.ok(atelierMain.includes('sendCollectionState()'),
    'the original artwork collection expands over the Lair canvas when opened');
  assert.ok(atelierCss.includes('.lair-embedded .workbench'),
    'the original tool bench is reused without recreating any controls');
  assert.ok(atelierMain.includes('getUnifiedScene()'),'original Atelier renders the combined Lair world');
  assert.ok(atelierFilter.includes('renderer.render(renderScene, camera)'),
    'the existing Atelier postprocessor draws the actual shared world scene');
  assert.ok(!main.includes('awaiting-ready'),'a missed readiness message cannot strand the player in the Lair');
  assert.ok(main.includes('createSharedRendererHost({renderer,canvas,worldScene:scene})'),
    'one renderer serves three actual rooms in the Lair world');
  assert.ok(source.includes('rendererHost?.activate(id)'),'shared renderer activates on arrival');
  assert.ok(source.includes('rendererHost?.deactivate(station)'),'shared renderer restores room rendering');
  assert.ok(bridge.includes('renderer.render(scene,camera)'),'actual original scene is rendered');
  for(const id of ['restoration','alchemy','workbench']){
    // Only the workbench opens as an embedded page; the others mount in the room.
    if (id === 'workbench') assert.equal(ORIGINAL_STATIONS[id].url,'/stations/workbench/');
    else assert.equal(ORIGINAL_STATIONS[id].url,undefined);
    assert.match(ORIGINAL_STATIONS[id].sourceUrl,/^https:\/\/[^/]+\.k1r11111\.chatgpt\.site\/$/);
    assert.ok(!html.includes(`id="${id}-workspace"`),`no imitation ${id} UI remains`);
  }
  // The lab asks the room's shared renderer for its canvas (no second GPU context).
  assert.ok(readFileSync(new URL('../../../workshops/alchemy/src/runtime-host.js',import.meta.url),'utf8').includes("host.createRenderer('alchemy', canvas)"));
  const alchemySource=readFileSync(new URL('../../../workshops/alchemy/src/alchemy.js',import.meta.url),'utf8');
  const alchemyVisualPanel=readFileSync(new URL('../../../workshops/alchemy/src/ui/visual-panel.js',import.meta.url),'utf8');
  assert.ok(alchemySource.includes("id === 'experience' && alchemyRoot !== document")
    && alchemyVisualPanel.includes("$('experience').classList"),
    'original visual-panel initialization resolves the renamed embedded experience root');
  assert.ok(alchemySource.includes('window.__keynlockLairCamera || camera')
    && alchemySource.includes('window.__keynlockLairManipulateAlchemy'),
    'embedded alchemy uses the Lair camera for picking and gestures');
  assert.ok(alchemySource.includes('window.__keynlockAlchemyInputPlane || canvas')
    && alchemySource.includes("inputSurface.addEventListener('pointerdown', onPointerDown)")
    && alchemySource.includes('if (!runtime.isActive()) return;')
    && nativeAlchemy.includes("inputPlane.id = 'alchemy-input-plane'")
    && source.includes("classList.toggle('is-active',alchemyInRoom)"),
    'alchemy receives input on a dedicated layer above the Lair controls only while active');
  assert.ok(transitions.includes("controls.enabled = id !== 'alchemy'"),
    'OrbitControls is suspended during laboratory manipulation and restored on exit');
  assert.ok(readFileSync(new URL('../public/stations/workbench/js/scene.js',import.meta.url),'utf8').includes("createRenderer('workbench',canvas)"));
  assert.ok(readFileSync(new URL('../public/stations/workbench/js/mechanism-3d.js',import.meta.url),'utf8').includes("createRenderer('workbench',canvas)"));
  assert.ok(readFileSync(new URL('../../../workshops/atelier/src/main.js',import.meta.url),'utf8').includes("createRenderer('restoration', document.createElement('canvas'))"));
  assert.equal((main.match(/new THREE\.WebGLRenderer/g)||[]).length,1);
  assert.ok(!main.includes('createAlchemyWorkspace'),'imitated laboratory is not imported');
  assert.ok(!main.includes('createWorkbenchWorkspace'),'imitated workbench is not imported');
  assert.ok(nativeAtelier.includes('@scope (#atelier-embedded-app)')
    && !atelierMain.includes("import './style.css'"),
    'the original styling cannot override the Lair camera and controls');
});
