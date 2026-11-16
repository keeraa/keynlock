/** Camera, focus transitions and 2D labels for the two painting easels. */
export function createSceneNavigation({ THREE, camera, controls, renderer, stage, easelX,
  cartoonFilter, labelLayer, getTexture, getTool, clearUV, damageHint, $ }) {
  let paintingCenterY = 1.91;
  let activeFocus = null;
  let lastFocusedSide = 'copy';
  let overviewPose = null;
  let cameraTravel = null;
  let stageWidth = 0, stageHeight = 0;
  const originalLabel = document.querySelector('.label-original');
  const copyLabel = document.querySelector('.label-copy');
  const labelProjection = new THREE.Vector3();

  Object.assign(labelLayer.style, { inset: '0', width: 'auto' });
  for (const label of [originalLabel, copyLabel]) {
    label.style.position = 'absolute';
    label.style.whiteSpace = 'nowrap';
  }

  function overviewDistance() {
    return camera.aspect < 1.24 ? 10.7 : camera.aspect < 1.6 ? 9.4 : camera.aspect < 2.1 ? 8.25 : 7.65;
  }

  function focusDestination(side, preserveZoom = false) {
    const x = side === 'original' ? -easelX : easelX;
    const z = camera.aspect < 1.3 ? 4.75 : 4.43;
    const target = new THREE.Vector3(x, paintingCenterY, .39);
    if (preserveZoom) return { position: target.clone().add(camera.position.clone().sub(controls.target)), target };
    // Wide paintings sit higher. Keep the destination inside OrbitControls'
    // polar limits so re-enabling controls cannot snap the view at arrival.
    const distanceZ = z - target.z;
    const lowestY = target.y + distanceZ / Math.tan(controls.maxPolarAngle - .025);
    const highestY = target.y + distanceZ / Math.tan(controls.minPolarAngle + .025);
    const y = THREE.MathUtils.clamp(2.02, lowestY, highestY);
    return { position: new THREE.Vector3(x, y, z), target };
  }

  function flyCamera(destination) {
    clearUV();
    damageHint.hidden = true;
    const fromPosition = camera.position.clone();
    const fromTarget = controls.target.clone();
    // Drain pending OrbitControls inertia without changing the visible pose.
    // A disabled-damping update would otherwise cause a jump on click.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    camera.position.copy(fromPosition);
    controls.target.copy(fromTarget);
    camera.lookAt(fromTarget);
    cameraTravel = {
      started: performance.now(), duration: 780,
      fromPosition, fromTarget,
      toPosition: destination.position.clone(), toTarget: destination.target.clone(),
    };
    controls.enabled = false;
  }

  function updateStepper() {
    const stepper = document.querySelector('.painting-stepper');
    const previous = $('prev-painting');
    const next = $('next-painting');
    stepper.classList.add('focused');
    if (activeFocus) {
      $('step-number').textContent = activeFocus === 'original' ? 'ОРИГИНАЛ' : 'КОПИЯ';
      previous.disabled = activeFocus === 'original';
      next.disabled = activeFocus === 'copy';
      previous.setAttribute('aria-label', 'Перейти к оригиналу');
      next.setAttribute('aria-label', 'Перейти к изменённой копии');
    } else {
      $('step-number').textContent = 'СРАВНЕНИЕ';
      previous.disabled = next.disabled = false;
      previous.setAttribute('aria-label', 'Приблизить оригинал');
      next.setAttribute('aria-label', 'Приблизить изменённую копию');
    }
  }

  function updateFocusedHint() {
    $('scene-hint-text').textContent = getTool()
      ? 'Зажмите на копии — реставрация · S/↓ — общий вид · A/D — картины'
      : '← / A — оригинал · → / D — копия · Пробел — сменить · S / ↓ — общий вид';
  }

  function focusOn(side) {
    if (!getTexture() || (side !== 'original' && side !== 'copy') || activeFocus === side) return;
    lastFocusedSide = side;
    const changingSide = Boolean(activeFocus);
    if (!changingSide) overviewPose = { position: camera.position.clone(), target: controls.target.clone() };
    activeFocus = side;
    controls.minDistance = 1.12;
    document.querySelector('.stage').classList.add('focused');
    labelLayer.classList.add('is-focused');
    $('focus-exit').hidden = false;
    updateFocusedHint();
    updateStepper();
    flyCamera(focusDestination(side, changingSide));
  }

  function leaveFocus({ immediate = false } = {}) {
    if (!activeFocus) return;
    clearUV();
    damageHint.hidden = true;
    activeFocus = null;
    controls.minDistance = 5.25;
    document.querySelector('.stage').classList.remove('focused');
    labelLayer.classList.remove('is-focused');
    $('focus-exit').hidden = true;
    $('scene-hint-text').innerHTML = 'Клик / W / ↑ — приблизить <span class="hint-divider">·</span> S / ↓ — общий вид <span class="hint-divider">·</span> A/D, ←/→ — картины';
    updateStepper();
    const destination = overviewPose || {
      position: new THREE.Vector3(0, paintingCenterY + .4, overviewDistance()),
      target: new THREE.Vector3(0, paintingCenterY, 0),
    };
    const offsetY = paintingCenterY - destination.target.y;
    destination.target.y = paintingCenterY;
    destination.position.y += offsetY;
    overviewPose = null;
    if (immediate) {
      cameraTravel = null;
      controls.enabled = true;
      camera.position.copy(destination.position);
      controls.target.copy(destination.target);
      controls.update();
    } else flyCamera(destination);
  }

  function setPaintingCenterY(next) {
    paintingCenterY = next;
    if (activeFocus) return;
    const offsetY = paintingCenterY - controls.target.y;
    controls.target.y = paintingCenterY;
    camera.position.y += offsetY;
    controls.update();
  }

  function updateLabel(element, x, y, z) {
    labelProjection.set(x, y, z).project(camera);
    element.style.left = `${(labelProjection.x * .5 + .5) * stage.clientWidth}px`;
    element.style.top = `${(-labelProjection.y * .5 + .5) * stage.clientHeight}px`;
    element.style.transform = 'translate(-50%, -50%)';
  }

  function renderLabels() {
    const texture = getTexture();
    if (!texture) return;
    const aspect = (texture.image.naturalWidth || texture.image.width) / (texture.image.naturalHeight || texture.image.height);
    const height = Math.min(2.28, 2.17 / aspect);
    const labelY = paintingCenterY + height / 2 + .17;
    updateLabel(originalLabel, -easelX - .62, labelY, .45);
    updateLabel(copyLabel, easelX + .62, labelY, .45);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    if (w === stageWidth && h === stageHeight) return;
    stageWidth = w;
    stageHeight = h;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1.35 ? 44 : 39;
    camera.updateProjectionMatrix();
    if (cameraTravel) {
      // ResizeObserver can fire while focus controls change layout. Preserve
      // the running interpolation and adjust only its destination.
      if (activeFocus) {
        const destination = focusDestination(activeFocus);
        cameraTravel.toPosition.copy(destination.position);
        cameraTravel.toTarget.copy(destination.target);
      }
    } else {
      controls.enabled = true;
      if (activeFocus) {
        const centerX = activeFocus === 'original' ? -easelX : easelX;
        const offsetX = centerX - controls.target.x;
        controls.target.x = centerX;
        camera.position.x += offsetX;
      } else {
        camera.position.set(0, paintingCenterY + .4, overviewDistance());
        controls.target.set(0, paintingCenterY, 0);
      }
      controls.update();
    }
    renderer.setSize(w, h);
    cartoonFilter.resize(w, h);
    renderLabels();
  }

  function animate(now) {
    if (!cameraTravel) return controls.update();
    const progress = Math.max(0, Math.min(1, (now - cameraTravel.started) / cameraTravel.duration));
    // Quintic smoothstep has zero velocity and acceleration at both ends.
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    camera.position.lerpVectors(cameraTravel.fromPosition, cameraTravel.toPosition, eased);
    controls.target.lerpVectors(cameraTravel.fromTarget, cameraTravel.toTarget, eased);
    camera.lookAt(controls.target);
    if (progress >= 1) {
      cameraTravel = null;
      controls.enabled = true;
      // Don't carry an old orbit delta into the first frame after arrival.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
    }
    return true;
  }

  $('focus-exit').addEventListener('click', () => leaveFocus());
  $('prev-painting').addEventListener('click', () => focusOn('original'));
  $('next-painting').addEventListener('click', () => focusOn('copy'));
  new ResizeObserver(resize).observe(stage);

  return { focusOn, leaveFocus, updateStepper, updateFocusedHint, setPaintingCenterY,
    renderLabels, resize, animate, isTraveling: () => Boolean(cameraTravel),
    focusedSide: () => activeFocus, lastFocusedSide: () => lastFocusedSide };
}
