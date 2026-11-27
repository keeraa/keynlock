import {createArchiveBirds} from '../environment/birds.js';
import {bindBirdControls} from '../ui/bird-controls.js';
import {bindCollection} from '../ui/collection.js';
import { VISUAL_DEFAULTS, RENDER_DEFAULTS } from '../../config/runtime.js';
import { createLifecycle } from './lifecycle.js';
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
import { createScaleInspector } from '../debug/scale-inspector.js';
import { t, localizeDocument } from '../localization/i18n.js';

// The standalone host owns the only renderer, loop and browser listeners.
// Manor integration should use scene/create-scene.js instead.
export function startArchiveApplication({ THREE, config, catalog, initialSelection }) {
  const life = createLifecycle();
  const elements = id => document.getElementById(id);
  const canvas = elements('scene');
  let disposed = false;
  let frameId;
  let last = performance.now();
  let mode = 'intro';

  function own(resource) {
    life.own(() => resource.dispose());
    return resource;
  }

  try {
    localizeDocument();
    const renderer = own(createArchiveRenderer(THREE, canvas));
    const world = own(createArchiveScene({
      THREE, renderer, config, cloudSettings: readCloudSettings(), translate: t,
    }));
    const { scene, camera, layout, navigation, building } = world;
    world.birds=own(createArchiveBirds({THREE,scene,renderer,config}));
    const painted = own(createPaintedRenderer(renderer, scene, camera, { ...VISUAL_DEFAULTS }));
    const player = createPlayerController({ THREE, camera, navigation, config });
    const plan = own(createFloorPlan({ THREE, config, layout }));
    const hud = own(createHud({ canvas, camera, layout, config, elements }));
    const inspector = own(createScaleInspector({ THREE, scene, camera, building, layout, config }));
    const lock = own(createPointerLock({
      canvas, document,
      isPlayMode: () => mode === 'play',
      onLocked: () => player.clearInput(),
      onBrowserUnlock: () => setMode('pause'),
    }));
    own(bindCloudControls(world.clouds));
    own(bindBirdControls(world.birds));

    function setMode(next) {
      const previous = mode;
      mode = next;
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

    const actions = {
      play: () => setMode('play'),
      pause: () => setMode(mode === 'play' ? 'pause' : 'play'),
      plan: () => setMode(mode === 'plan' ? 'play' : 'plan'),
      scale: () => inspector.toggle(),
      zoom: delta => plan.zoom(delta),
      hints: () => hud.hints(),
      wallPick:()=>collection.wallPick(),
      canRaise: () => collection.canRaise(),
      raise: value => collection.raise(value),
      drop: () => collection.drop(),
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
    const input=own(bindPlayerInput({ canvas, player, getMode: () => mode, lock, actions }));
    own(bindInterface({ elements, actions, world, inspector, plan, hud, player, getMode: () => mode }));

    const params=new URLSearchParams(location.search);
    const collection = own(bindCollection({debugSelection:params.get('debug')==='selection',THREE,renderer,world,config,catalog,initialSelection,player,setMode,getMode:()=>mode,elements,notify:hud.toast}));

    own(bindPlayerSettings({ player, painted, elements, collection, ink:world.ink,setSkyColor:world.setSkyColor }));

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
      const dt = Math.min((now - last) / 1000, .04);
      last = now;
      player.update(dt, now, mode === 'play');
      world.clouds.update(mode === 'play' ? dt : 0);
      world.birds.update(mode === 'play' ? dt : 0);
      hud.updateLocation(mode, player.state.floorY);
      // A fresh shadow map needs every caster, including wings behind the viewer.
      world.updateVisibility(camera,mode==='plan' || renderer.shadowMap.needsUpdate);
      collection.syncVisibility(mode==='plan' ? plan.camera : camera);
      inspector.update(now);
      if(mode!=='plan')collection.update(now);
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

    elements('loading').textContent = t('Галереи · купол · лестница');
    elements('start-btn').disabled = false;
    elements('intro-plan').disabled = false;
    setMode('intro');
    if(params.get('mode')==='hang')collection.switchHanging(true);
    collection.locate(params.get('art'));
    frameId = requestAnimationFrame(frame);
    life.own(() => cancelAnimationFrame(frameId));

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
