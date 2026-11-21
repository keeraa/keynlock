// @ts-check
/** Interpolate a camera and its orbit target while the host handles input. */
export function createCameraTransition({ camera, controls, onStart = () => {},
  setInputBlocked = blocked => { controls.enabled = !blocked; } }) {
  let travel = null;

  function start(destination, duration = 780, onComplete = null) {
    onStart();
    const fromPosition = camera.position.clone();
    const fromTarget = controls.target.clone();
    // Drain pending damping without changing the visible pose.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    camera.position.copy(fromPosition);
    controls.target.copy(fromTarget);
    camera.lookAt(fromTarget);
    travel = { started: performance.now(), duration, onComplete, fromPosition, fromTarget,
      toPosition: destination.position.clone(), toTarget: destination.target.clone() };
    setInputBlocked(true);
  }

  function retarget(destination) {
    if (!travel) return;
    travel.toPosition.copy(destination.position);
    travel.toTarget.copy(destination.target);
  }

  function cancel() {
    travel = null;
    setInputBlocked(false);
  }

  function update(now) {
    if (!travel) return false;
    const progress = Math.max(0, Math.min(1, (now - travel.started) / travel.duration));
    const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
    camera.position.lerpVectors(travel.fromPosition, travel.toPosition, eased);
    controls.target.lerpVectors(travel.fromTarget, travel.toTarget, eased);
    camera.lookAt(controls.target);
    if (progress >= 1) {
      const onComplete = travel.onComplete;
      travel = null;
      setInputBlocked(false);
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
      onComplete?.();
    }
    return true;
  }

  return { start, retarget, cancel, update, isTraveling: () => Boolean(travel) };
}
