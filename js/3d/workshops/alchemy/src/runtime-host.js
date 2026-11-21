import { getWorkshopHost } from '../../../core/host/workshop-host.js';

/** Integration boundary shared by the standalone laboratory and KEYNLOCK Lair.
 * The host is optional: a direct visit keeps its own renderer and canvas.
 */
export const ALCHEMY_BRIDGE = 'keynlock:alchemy:v1';

/** The Lair's shared renderer when the lab is mounted in the room, otherwise null. */
export function resolveAlchemyHost() {
  return getWorkshopHost()?.renderer ?? null;
}

export function createAlchemyRuntime({THREE, canvas, win = window, host = resolveAlchemyHost()}) {
  const renderer = host
    ? host.createRenderer('alchemy', canvas)
    : new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
  let active = true;
  let disposed = false;
  let frame = null;
  let ready = false;
  let unregisterWorkshop;
  let onEnter;
  let onExit;

  const announce = (type, detail = {}) => {
    const message = {bridge: ALCHEMY_BRIDGE, type, ...detail};
    win.dispatchEvent(new CustomEvent(ALCHEMY_BRIDGE, {detail: message}));
  };
  function setActive(value) {
    const next = Boolean(value);
    if (disposed || active === next) return;
    if (next) onEnter?.();
    else onExit?.();
    active = next;
    announce(active ? 'resume' : 'pause');
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
        if (!ready) {ready = true; announce('ready');}
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
      if (!ready) {ready = true; announce('ready');}
    },
    setActive,
    isActive() { return active && !disposed; },
    announce,
    dispose() {
      if (disposed) return;
      unregisterWorkshop?.();
      disposed = true;
      renderer.setAnimationLoop(null);
      if (!host) renderer.dispose();
      announce('disposed');
    },
  };
}
