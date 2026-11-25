import {createArchiveBirds} from '../environment/birds.js';
import {GLTFLoader} from '../../vendor/loaders/GLTFLoader.js';
import {bindCollection} from '../ui/collection.js';
import { VISUAL_DEFAULTS, RENDER_DEFAULTS } from '../../config/runtime.js';
import { createLifecycle } from './lifecycle.js';
import { createFrameLimit } from './frame-limit.js';
import { createArchiveAudio } from '../audio/archive-audio.js';
import { mountArchiveMusic } from '../audio/archive-music.js';
import { createArchiveRenderer } from '../rendering/create-renderer.js';
import { createPaintedRenderer } from '../rendering/painted-renderer.js';
import { createArchiveScene } from '../scene/create-scene.js';
import { createPlayerController } from '../player/controller.js';
import { bindPlayerInput } from '../player/bind-input.js';
import { createPointerLock } from '../player/pointer-lock.js';
import { createFloorPlan } from '../ui/plan.js';
import { createHud } from '../ui/hud.js';
import { bindInterface } from '../ui/bind-interface.js';
import { bindPlayerSettings } from '../ui/settings.js';
import { readCloudSettings, bindCloudControls } from '../ui/cloud-controls.js';
import { resetArchiveProgress } from '../persistence/new-game.js';
import { t, localizeDocument } from '../localization/i18n.js';

// The standalone host owns the only renderer, loop and browser listeners.
// Manor integration should use scene/create-scene.js instead.
export async function startArchiveApplication({ THREE, config, catalog, initialSelection, onProgress=()=>{} }) {
  const life = createLifecycle();
  const elements = id => document.getElementById(id);
  const canvas = elements('scene');
  const frameLimit=createFrameLimit();
  let disposed = false;
  let frameId;
  let last = performance.now();
  let mode = 'intro';
  let starting = true;
  let music;

  function own(resource) {
    life.own(() => resource.dispose());
    return resource;
  }

  try {
    localizeDocument();
    const loadingManager=new THREE.LoadingManager(),failures=new Set();
    let progress=12;
    const assetsReady=new Promise(resolve=>{loadingManager.onLoad=resolve;});
    loadingManager.onError=url=>failures.add(url);
    loadingManager.onProgress=(_url,loaded,total)=>{
      progress=Math.max(progress,12+Math.round(65*loaded/total));
      if(starting)onProgress(progress);
    };
    loadingManager.itemStart('scene setup');
    const modelLoader=new GLTFLoader(loadingManager);
    const renderer = own(createArchiveRenderer(THREE, canvas));
    const world = own(createArchiveScene({
      THREE, renderer, config, loadingManager, loadModel:url=>modelLoader.loadAsync(url), cloudSettings: readCloudSettings(), translate: t,
    }));
    const { scene, camera, layout, navigation, building } = world;
    const audio=own(createArchiveAudio(layout));
    world.birds=own(createArchiveBirds({THREE,scene,renderer,config,loadingManager}));
    const painted = own(createPaintedRenderer(renderer, scene, camera, { ...VISUAL_DEFAULTS }));
    const player = createPlayerController({ THREE, camera, navigation, config });
    const plan = own(createFloorPlan({ THREE, config, layout }));
    const hud = own(createHud({ canvas, camera, layout, config, elements }));
    const lock = own(createPointerLock({
      canvas, document,
      isPlayMode: () => mode === 'play',
      onLocked: () => player.clearInput(),
      onBrowserUnlock: () => setMode('pause'),
    }));
    own(bindCloudControls(world.clouds));
    const birdsReady=world.birds.configure('both');

    function setMode(next) {
      const previous = mode;
      mode = next;
      audio.setPlaying(next==='play');
      music?.setPaused(next!=='play');
      if(next==='pause'&&previous==='play')audio.play('menu');
      if(next!=='play')input.resetGesture();
      player.clearInput();
      if (next !== 'play') lock.release();
      hud.refreshMode(next);
      world.clouds.setVisible(next !== 'plan');
      world.birds.setVisible(next !== 'plan');
      plan.setVisible(next === 'plan');
      building.setCutaway(next === 'plan');
      if (next === 'play') {
        lock.retry();
        lock.request();
      }
      if (previous === 'plan' || next === 'plan') renderer.shadowMap.needsUpdate = true;
    }

    const params=new URLSearchParams(location.search);
    const debugSelection=params.get('debug')==='selection';
    const actions = {
      newGame(){
        if(!window.confirm(t('Начать новую игру? Развешивание, утилизация и обучение начнутся заново. Подборка и настройки сохранятся.')))return;
        try{
          if(resetArchiveProgress(window.localStorage,debugSelection)){
            const url=new URL(location.href);
            url.searchParams.delete('art');
            url.searchParams.delete('mode');
            if(url.href===location.href)location.reload();
            else location.replace(url.href);
            return;
          }
        }catch { /* Storage may be blocked by the browser. */ }
        hud.toast('Не удалось начать новую игру.');
      },
      play: () => setMode('play'),
      pause: () => setMode(mode === 'play' ? 'pause' : 'play'),
      openMenu: () => setMode(mode === 'pause' ? 'play' : 'pause'),
      plan: () => setMode(mode === 'plan' ? 'play' : 'plan'),
      zoom: delta => plan.zoom(delta),
      hints: () => hud.hints(),
      wallPick:()=>collection.wallPick(),
      canRaise: () => collection.canRaise(),
      raise: value => collection.raise(value),
      aimedId: () => collection.aimedId(),
      exclude: () => collection.exclude(),
      inspect: () => collection.inspect(),
      interact(heldId) {
        if (collection.interact(heldId)) return;
        if (!hud.canInteract()) return;
        hud.toast('Здесь будет переход в логово. Сейчас доступна лестница и площадка второго этажа.');
        window.dispatchEvent(new CustomEvent('keynlock:art-archive-exit', {
          detail: { destination: 'lair', floor: 2 },
        }));
      },
    };
    const input=own(bindPlayerInput({ canvas, player, hideProgress:elements('hide-progress'), getMode: () => starting?'loading':mode, lock, actions }));
    own(bindInterface({ elements, actions, world, plan, hud, player, getMode: () => mode }));

    const collection = own(bindCollection({debugSelection,initialHanging:params.get('mode')!=='walk',THREE,renderer,world,config,catalog,initialSelection,player,setMode,getMode:()=>mode,elements,notify:hud.toast,loadingManager,playSound:audio.play,setSoundMotion:audio.setMotion}));

    own(bindPlayerSettings({ player, painted, elements, collection, dust:world.dust, ink:world.ink,
      setSkyColor:world.setSkyColor,setWallFinish:world.setWallFinish,setFrameLimit:frameLimit.setEnabled }));
    music=own(mountArchiveMusic({window,elements}));

    function resize() {
      const width = innerWidth;
      const height = innerHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, RENDER_DEFAULTS.pixelRatio));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      painted.resize();
      plan.resize(width, height);
    }
    life.listen(window, 'resize', resize);
    resize();
    renderer.shadowMap.needsUpdate = true;
    canvas.dataset.engine = THREE.REVISION;
    canvas.dataset.halls = String(config.halls.length);

    let lastDiagnostics = -Infinity;
    function frame(now) {
      if (disposed) return;
      frameId = requestAnimationFrame(frame);
      if(!frameLimit.shouldRender(now))return;
      const dt = Math.min((now - last) / 1000, .04);
      last = now;
      const canSprint=collection.canSprint();
      const distance=player.update(dt,now,mode==='play',canSprint);
      audio.walk(distance,camera.position,player.state.floorY,canSprint&&player.held.has('shift'));
      world.clouds.update(mode === 'play' ? dt : 0);
      world.birds.update(mode === 'play' ? dt : 0);
      if(mode==='play' && world.dust.points.visible)world.dust.update(now/1000);
      hud.updateLocation(mode, player.state.floorY);
      // A fresh shadow map needs every caster, including wings behind the viewer.
      world.updateVisibility(camera,mode==='plan' || renderer.shadowMap.needsUpdate);
      collection.syncVisibility(mode==='plan' ? plan.camera : camera);
      if(mode!=='plan')collection.update(now);
      input.update(now);
      renderer.info.reset();
      if (mode === 'plan') renderer.render(scene, plan.camera);
      else painted.render();
      if (now-lastDiagnostics >= 200) {
        lastDiagnostics = now;
        const { floorY, yaw, pitch } = player.state;
        canvas.dataset.player = JSON.stringify({
          x: camera.position.x, z: camera.position.z, floorY, yaw, pitch, fov: camera.fov, mode,
        });
        canvas.dataset.visual = JSON.stringify(painted.getStatus());
        canvas.dataset.triangles = String(renderer.info.render.triangles);
      }
      hud.performance(now, renderer, world.clouds);
    }

    setMode('intro');
    collection.locate(params.get('art'));
    life.own(() => cancelAnimationFrame(frameId));
    loadingManager.itemEnd('scene setup');
    await Promise.all([assetsReady,birdsReady]);
    if(failures.size)throw new Error(t('Часть ресурсов сцены не загрузилась. Перезагрузите страницу.'));
    onProgress(80);
    player.prepareView();
    player.update(0, performance.now(), false);
    world.updateVisibility(camera);
    collection.syncVisibility();
    await new Promise(resolve=>{
      function prepare(now){
        const prepared=collection.warmUp(now);
        onProgress(80+Math.round(16*prepared));
        if(prepared===1)resolve();
        else frameId=requestAnimationFrame(prepare);
      }
      frameId=requestAnimationFrame(prepare);
    });
    onProgress(96);
    last=performance.now();
    frame(last);
    starting=false;
    elements('start-btn').disabled = false;

    const inspect = () => ({
      engine: THREE.REVISION, mode, floorY: player.state.floorY,
      position: camera.position.toArray(), hallCount: layout.halls.length,
      visibleHalls:[...world.visibleHalls], stats: world.stats, visual: painted.getStatus(), drawCalls: renderer.info.render.calls,
    });
    window.archiveInspect = inspect;
    life.own(() => { if (window.archiveInspect === inspect) delete window.archiveInspect; });

    const app = {
      dispose() {
        if (disposed) return;
        disposed = true;
        life.dispose();
      },
    };
    life.listen(window, 'pagehide', () => app.dispose(), { once: true });
    return app;
  } catch (error) {
    disposed = true;
    life.dispose();
    throw error;
  }
}
