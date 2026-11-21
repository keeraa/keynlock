import { getWorkshopHost } from '../../../core/host/workshop-host.js';

/** The Lair's shared renderer when the lab is mounted in the room, otherwise null. */
export function resolveAlchemyHost() {
  return getWorkshopHost()?.renderer ?? null;
}

export function createAlchemyRuntime({THREE, canvas, host = resolveAlchemyHost(), onActiveChange = (active) => {}}) {
  const renderer = host
    ? host.createRenderer('alchemy', canvas)
    : new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
  let active = true;
  let disposed = false;
  let frame = null;
  let unregisterWorkshop;
  let onEnter;
  let onExit;

  function setActive(value) {
    const next = Boolean(value);
    if (disposed || active === next) return;
    if (next) onEnter?.();
    else onExit?.();
    active = next;
    onActiveChange(active);
  }

  return {
    renderer,
    embedded: Boolean(host),
    registerScene(scene, camera, additionalScenes = []) {
      if (host) host.registerWorldScene('alchemy', {scene, camera, additionalScenes});
    },
    start(render, { enter, exit } = {}) {
      frame = render;
      onEnter = enter;
      onExit = exit;
      if (host?.registerWorldWorkshop) {
        unregisterWorkshop = host.registerWorldWorkshop('alchemy', {
          enter: () => setActive(true),
          exit: () => setActive(false),
          update() { if (active && !disposed) frame(); },
        }, { interval: 25 });
        return;
      }
      let lastStep = 0;
      renderer.setAnimationLoop((now = performance.now()) => {
        if (!active || disposed) {lastStep = 0;return;}
        // Embedded alchemy only advances its liquid simulation. The parent
        // renderer is responsible for displaying every visual frame.
        if (host && lastStep && now - lastStep < 1000 / 20) return;
        lastStep = now;
        frame();
      });
    },
    setActive,
    isActive() { return active && !disposed; },
    dispose() {
      if (disposed) return;
      unregisterWorkshop?.();
      disposed = true;
      renderer.setAnimationLoop(null);
      if (!host) renderer.dispose();
      if (active) onActiveChange(false);
    },
  };
}
