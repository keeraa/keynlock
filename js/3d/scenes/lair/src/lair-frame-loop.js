import { Clock } from 'three';

export function startLairFrames({ scene, camera, controls, renderer, rendererHost, atelierFilter,
  room, dayNight, zoneTransitions, zoneInteraction, roomWalk, atelierView, workshopOverlay,
  visualUI, performancePanel }) {
  const clock = new Clock();
  const drawn = { triangles: 0, calls: 0 };

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
    zoneTransitions.updateApproach(delta);
    if (roomWalk.isActive()) roomWalk.update(delta);
    else if (!atelierView.updateFlight(now) && zoneTransitions.current() !== 'alchemy') controls.update();
    rendererHost.stepWorldRuntime(now);
    atelierView.updateGalleryCamera();

    for (const update of room.animated) update(clock.elapsedTime);
    const currentZone = zoneTransitions.current();
    const overlayOpen = workshopOverlay.isOpen();
    zoneInteraction.update(currentZone);
    atelierView.updateInterface({ zone: currentZone, visualOpen: visualUI.isOpen(), overlayOpen });
    rendererHost.updateWorld();
    // Embedded renderers can leave autoReset disabled for their passes.
    renderer.info.reset();
    if (!overlayOpen || zoneTransitions.isTransitioning()) render(currentZone);
    performancePanel.frame(frameDelta, performance.now() - now, drawn);
  }

  frame();
}
