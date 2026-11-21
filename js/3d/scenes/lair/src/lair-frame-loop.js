import { Clock } from 'three';

export function startLairFrames({ scene, camera, controls, renderer, rendererHost, atelierFilter,
  room, dayNight, zoneTransitions, zoneInteraction, cameraInput, atelierView, workshopOverlay, returnButton,
  visualUI, performancePanel }) {
  const clock = new Clock();
  const drawn = { triangles: 0, calls: 0 };
  // The shadow map (317 casters) is redrawn when the zone changes and once a
  // second, not every frame: only the lab's bottles and the Atelier's
  // paintings ever move, and the lab asks for its own refresh when it needs one.
  const SHADOW_REFRESH_MS = 1000;
  let lastShadowRefresh = -Infinity, shadowZone;
  function refreshShadows(now, zone) {
    if (zone === shadowZone && now - lastShadowRefresh < SHADOW_REFRESH_MS) return;
    shadowZone = zone;
    lastShadowRefresh = now;
    renderer.shadowMap.needsUpdate = true;
  }

  function render(currentZone) {
    rendererHost.prepareWorldLightsForRender();
    try {
      if (currentZone === 'atelier') {
        atelierFilter.setFocus(camera.position.distanceTo(controls.target));
        const frame = atelierFilter.render();
        drawn.triangles = frame.triangles ?? renderer.info.render.triangles;
        drawn.calls = frame.calls ?? renderer.info.render.calls;
      } else {
        renderer.render(scene, camera);
        drawn.triangles = renderer.info.render.triangles;
        drawn.calls = renderer.info.render.calls;
      }
    } finally {
      rendererHost.restoreWorldLightsAfterRender();
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const frameDelta = clock.getDelta();
    const delta = Math.min(frameDelta, .05);
    dayNight.update(frameDelta);
    cameraInput.update(delta, now);
    rendererHost.stepWorldRuntime(now);
    cameraInput.syncGalleryCamera();

    for (const update of room.animated) update(clock.elapsedTime);
    const currentZone = zoneTransitions.current();
    room.windowLight?.setAirHidden(currentZone === 'atelier');
    returnButton?.update({ zone: currentZone, walking: cameraInput.isWalking(), overlayOpen: workshopOverlay.isOpen() });
    const overlayOpen = workshopOverlay.isOpen();
    zoneInteraction.update(currentZone);
    atelierView.updateInterface({ zone: currentZone, visualOpen: visualUI.isOpen(), overlayOpen });
    rendererHost.updateWorld();
    // Embedded renderers can leave autoReset disabled for their passes.
    renderer.info.reset();
    refreshShadows(now, currentZone);
    if (!overlayOpen || zoneTransitions.isTransitioning()) render(currentZone);
    performancePanel.frame(frameDelta, performance.now() - now, drawn);
  }

  frame();
}
