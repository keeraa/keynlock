import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINAL_STATIONS } from '../src/original-stations.js';
import { REAGENTS, emptyMixture, addDose } from '../src/alchemy-core/mixing.js';
import { generateRecipe, evaluateRecipe } from '../src/alchemy-core/recipes.js';
import { assistedFilingStroke, cutLayout, generateBlueprint,
  inspectKey, keyTopOutline, targetGuideSegments } from '../src/workbench-core/logic.js';

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
  const source=readFileSync(new URL('../src/original-stations.js',import.meta.url),'utf8');
  const nativeAtelier=readFileSync(new URL('../src/atelier-in-room.js',import.meta.url),'utf8');
  const bridge=readFileSync(new URL('../src/shared-renderer-host.js',import.meta.url),'utf8');
  assert.equal((html.match(/<canvas\s+id="scene"/g)||[]).length,1);
  assert.ok(html.includes('id="scene-interaction"'),'a stable input layer covers the 3D scene');
  assert.ok(html.includes('id="original-station-frame"'),'original app preserves its full DOM');
  assert.ok(main.includes('originalStations.preload(id)'),'original app is prepared when its zone is clicked');
  assert.ok(main.includes('originalStations.showRestorationInRoom()'),
    'original Atelier workbench controls are shown in the Lair itself');
  assert.match(main,/if \(restoring\) \{[\s\S]*?originalStations\.showRestorationInRoom\(\);[\s\S]*?\} else originalStations\.open\(id\);/,
    'restoration never opens a different full-screen workshop');
  assert.ok(main.includes('mountAtelierInRoom()')
    && nativeAtelier.includes("document.querySelector('#app').appendChild(atelier)"),
    'the exact original Atelier DOM is mounted into the Lair document');
  assert.ok(nativeAtelier.includes("import('../integrations/atelier/src/main.js')"),
    'the original Atelier source runs directly in the Lair page');
  assert.ok(source.includes("const names = ['alchemy','workbench']")
    && !source.includes("ensureFrame('restoration')"),
    'no restoration iframe is created or loaded');
  assert.ok(!main.includes('connectAtelier('),
    'the obsolete cross-origin hidden atelier iframe is not loaded');
  assert.ok(!main.includes('originalStations.preloadAll()'),
    'unvisited workshops do not start detached documents during Lair startup');
  assert.ok(!html.includes('id="restoration-dock"'),
    'no replacement tools or imitation painting panel are created');
  assert.ok(main.includes('controls.minAzimuthAngle = -Infinity'),
    'free orbiting remains possible at every viewpoint');
  assert.ok(main.includes('new OrbitControls(camera, interaction)')
    && main.includes('controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE')
    && main.includes('controls.enableRotate = true'),
  'the camera rotates when dragging the dedicated scene interaction layer');
  assert.ok(main.includes("interaction.addEventListener('pointermove', hover3D)"),
    'room hit testing and camera events use the same input surface');
  assert.ok(main.includes('window.__keynlockRestorationActive = restoring'),
    'original painting tools only receive the parent canvas pointer in restoration mode');
  assert.ok(main.includes('buildLair(scene, materials, {useOriginalRestoration:true})'),
    'the mock restoration easels are never created next to the source easels');
  assert.ok(main.includes("scene.getObjectByName('atelier-original-wallpaper')")
    && main.includes('atelierWall.visible = false')
    && !main.includes('lairWall.material = atelierWall.material'),
    'the Lair keeps its independently loaded original gouache wallpaper instead of an unfinished Atelier placeholder');
  assert.ok(!main.includes("originalStations.open(workspace)"),
    'the old portal/iframe workspace swap no longer drives Atelier transitions');
  const atelierMain=readFileSync(new URL('../integrations/atelier/src/main.js',import.meta.url),'utf8');
  const atelierInput=readFileSync(new URL('../integrations/atelier/src/restoration-input.js',import.meta.url),'utf8');
  const atelierMarkup=readFileSync(new URL('../integrations/atelier/index.html',import.meta.url),'utf8');
  const atelierUI=readFileSync(new URL('../integrations/atelier/src/workshop-ui.js',import.meta.url),'utf8');
  const atelierCss=readFileSync(new URL('../integrations/atelier/src/style.css',import.meta.url),'utf8');
  const atelierFilter=readFileSync(new URL('../integrations/atelier/src/effects/cartoon-filter.js',import.meta.url),'utf8');
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
    && main.includes('window.__keynlockLairFocusArtwork'),
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
    assert.match(ORIGINAL_STATIONS[id].url,/^\/stations\/[^/]+\/$/);
    assert.match(ORIGINAL_STATIONS[id].sourceUrl,/^https:\/\/[^/]+\.k1r11111\.chatgpt\.site\/$/);
    assert.ok(!html.includes(`id="${id}-workspace"`),`no imitation ${id} UI remains`);
  }
  assert.ok(readFileSync(new URL('../public/stations/alchemy/alchemy.js',import.meta.url),'utf8').includes("createRenderer('alchemy', canvas)"));
  assert.ok(readFileSync(new URL('../public/stations/workbench/js/scene.js',import.meta.url),'utf8').includes("createRenderer('workbench',canvas)"));
  assert.ok(readFileSync(new URL('../public/stations/workbench/js/mechanism-3d.js',import.meta.url),'utf8').includes("createRenderer('workbench',canvas)"));
  assert.ok(readFileSync(new URL('../integrations/atelier/src/main.js',import.meta.url),'utf8').includes("createRenderer('restoration', document.createElement('canvas'))"));
  assert.equal((main.match(/new THREE\.WebGLRenderer/g)||[]).length,1);
  assert.ok(!main.includes('createAlchemyWorkspace'),'imitated laboratory is not imported');
  assert.ok(!main.includes('createWorkbenchWorkspace'),'imitated workbench is not imported');
  assert.ok(nativeAtelier.includes('@scope (#atelier-embedded-app)')
    && !atelierMain.includes("import './style.css'"),
    'the original styling cannot override the Lair camera and controls');
});
