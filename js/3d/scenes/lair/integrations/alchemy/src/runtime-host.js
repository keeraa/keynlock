/** Integration boundary shared by the standalone laboratory and KEYNLOCK Lair.
 * The host is optional: a direct visit keeps its own renderer and canvas.
 */
export const ALCHEMY_BRIDGE = 'keynlock:alchemy:v1';

export function resolveAlchemyHost(win = window) {
  // When entered through the Lair's station iframe, preserve this workshop's
  // own renderer/camera/input loop. The shared-world mounting remains optional.
  if (win.location?.search && new URLSearchParams(win.location.search).has('standalone')) return null;
  try {
    if (win.__keynlockRendererHost) return win.__keynlockRendererHost;
    if (win.parent !== win && win.parent.location.origin === win.location.origin) {
      const candidate = win.parent.__keynlockRendererHost;
      if (candidate?.createRenderer && candidate?.registerWorldScene) return candidate;
    }
  } catch { /* A cross-origin parent cannot supply the renderer. */ }
  return null;
}

export function createAlchemyRuntime({THREE, canvas, win = window, host = resolveAlchemyHost(win)}) {
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
    if (host && win.parent !== win) win.parent.postMessage(message, win.location.origin);
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
