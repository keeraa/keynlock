import { Vector3 } from 'three';

/** Own the active camera and input mode for the shared Lair view. */
export function createCameraInput({ camera, controls, roomWalk, atelierView, handleZoneKey,
  handleAtelierKey, handleAlchemyKey, updateApproach }) {
  const forward = new Vector3();
  const atelierInputBlocks = new Set();
  let mode = 'room';

  function syncOrbit() {
    const enabled = mode === 'room' || (mode === 'atelier' && atelierInputBlocks.size === 0);
    if (controls.enabled !== enabled) controls.enabled = enabled;
  }

  function setAtelierInputBlocked(reason, blocked) {
    if (blocked) atelierInputBlocks.add(reason);
    else atelierInputBlocks.delete(reason);
    syncOrbit();
  }

  let walkPose = null;
  /** walkPose: resume walking where the walker left off (back from a zone). */
  function setMode(next, { resumeWalk = false } = {}) {
    if (mode === next) return;
    const previous = mode;
    mode = next;
    if (previous === 'walk') {
      walkPose = roomWalk.getPose();
      roomWalk.stop();
      camera.getWorldDirection(forward);
      controls.target.copy(camera.position).addScaledVector(forward, Math.max(3, controls.minDistance));
    }
    syncOrbit();
    if (mode === 'walk') roomWalk.start(resumeWalk ? walkPose : null);
  }

  function update(delta, now) {
    updateApproach(delta);
    if (mode === 'walk') roomWalk.update(delta);
    else if (mode === 'room' || mode === 'atelier') {
      if (!atelierView.updateFlight(now)) controls.update();
    }
  }

  function syncGalleryCamera() {
    if (mode === 'gallery') atelierView.updateGalleryCamera();
  }

  function resize(fov) {
    if (mode === 'walk') roomWalk.resize();
    else if (mode !== 'gallery') camera.fov = fov;
  }

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    if (mode === 'walk' && roomWalk.handleKey(event)) return;
    if (mode === 'gallery' && atelierView.handleGalleryKey(event)) return;
    if (mode === 'atelier') {
      handleAtelierKey(event);
      if (event.defaultPrevented) return;
    }
    if (mode === 'alchemy' && handleAlchemyKey(event)) {
      event.preventDefault();
      return;
    }
    handleZoneKey(event);
  });
  document.addEventListener('keyup', event => {
    if (mode === 'walk') roomWalk.releaseKey(event.code);
  });

  return { setMode, setAtelierInputBlocked, update, syncGalleryCamera, resize,
    isWalking: () => mode === 'walk',
    isGallery: () => mode === 'gallery',
    canPickZone: () => mode === 'room' || mode === 'walk',
  };
}
