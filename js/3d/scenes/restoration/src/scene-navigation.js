/** Camera, focus transitions and 2D labels for the two painting easels. */
export function createSceneNavigation({ THREE, camera, controls, renderer, stage, easelX,
  cartoonFilter, labelLayer, getTexture, getTool, clearUV, damageHint, onWallChange = () => {}, $ }) {
  let paintingCenterY = 1.91;
  let activeFocus = null;
  let lastFocusedSide = 'copy';
  let overviewPose = null;
  let cameraTravel = null;
  let wallMode = false;
  let wallFocusedId = null;
  let wallArtwork = null;
  let wallOriginPose = null;
  let wallOverviewPose = null;
  let wallBounds = { minX: -15, maxX: 15, minY: 3.695, maxY: 11.85,
    width: 30, columnWidth: 2.5 };
  let originalControlLimits = null;
  let stageWidth = 0, stageHeight = 0;
  const originalLabel = document.querySelector('.label-original');
  const copyLabel = document.querySelector('.label-copy');
  // #scene hosts the WebGL canvas; overlay labels belong to its parent .stage.
  const stageShell = stage.closest?.('.stage') || stage;
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

  function flyCamera(destination, duration = 780, onComplete = null) {
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
      started: performance.now(), duration, onComplete,
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
    if (wallMode || !getTexture() || (side !== 'original' && side !== 'copy') || activeFocus === side) return;
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

  function resetFocusUI() {
    clearUV();
    damageHint.hidden = true;
    activeFocus = null;
    controls.minDistance = 5.25;
    document.querySelector('.stage').classList.remove('focused');
    labelLayer.classList.remove('is-focused');
    $('focus-exit').hidden = true;
    $('scene-hint-text').innerHTML = 'Клик / W / ↑ — приблизить <span class="hint-divider">·</span> S / ↓ — общий вид <span class="hint-divider">·</span> A/D, ←/→ — картины';
    updateStepper();
  }

  function leaveFocus({ immediate = false } = {}) {
    if (!activeFocus || wallMode) return;
    resetFocusUI();
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
    if (activeFocus || wallMode) return;
    const offsetY = paintingCenterY - controls.target.y;
    controls.target.y = paintingCenterY;
    camera.position.y += offsetY;
    controls.update();
  }

  function wallOverviewDistance() {
    // Fit the wall's height with a small margin. Fitting several full columns
    // horizontally made portrait screens fly too far back into the room.
    const height = Math.max(3, wallBounds.maxY - wallBounds.minY);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    return Math.max(8, height * 1.08 / (2 * Math.tan(verticalFov / 2)));
  }

  function visibleWallWidth(distance = wallOverviewDistance()) {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    return Math.min(wallBounds.width,
      2 * distance * Math.tan(verticalFov / 2) * camera.aspect);
  }

  function clampWallCenter(x, distance = wallOverviewDistance()) {
    const minX = wallBounds.minX ?? -wallBounds.width / 2;
    const maxX = wallBounds.maxX ?? wallBounds.width / 2;
    const inset = visibleWallWidth(distance) / 2;
    return THREE.MathUtils.clamp(x, minX + inset, maxX - inset);
  }

  function wallOverviewDestination(centerX = null) {
    const centerY = (wallBounds.minY + wallBounds.maxY) / 2;
    const minX = wallBounds.minX ?? -wallBounds.width / 2;
    const distance = wallOverviewDistance();
    const x = clampWallCenter(centerX ?? minX + visibleWallWidth(distance) / 2, distance);
    const target = new THREE.Vector3(x, centerY, -4.3);
    return { position: new THREE.Vector3(x, centerY, -4.3 + distance), target };
  }

  function wallArtDestination(art) {
    if (!art) return wallOverviewDestination();
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
    const distance = Math.max(2.2,
      art.height / (2 * Math.tan(fov / 2) * .72),
      art.width / (2 * Math.tan(horizontalFov / 2) * .75));
    const target = new THREE.Vector3(art.x, art.y, -4.3);
    return { position: new THREE.Vector3(art.x, art.y, -4.3 + Math.min(14, distance)), target };
  }

  function enterWallGallery(bounds = wallBounds) {
    if (wallMode) return;
    wallBounds = bounds;
    // Always return to the two easels, even when the gallery was opened from a closeup.
    const source = activeFocus && overviewPose ? overviewPose : { position: camera.position, target: controls.target };
    wallOriginPose = { position: source.position.clone(), target: source.target.clone() };
    if (activeFocus) resetFocusUI();
    overviewPose = null;
    originalControlLimits = {
      minDistance: controls.minDistance, maxDistance: controls.maxDistance,
      minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle,
      enableRotate: controls.enableRotate, enablePan: controls.enablePan,
      leftButton: controls.mouseButtons?.LEFT,
    };
    wallMode = true;
    controls.minDistance = 1.35;
    controls.maxDistance = wallOverviewDistance() * 1.18;
    controls.minPolarAngle = .05;
    controls.maxPolarAngle = Math.PI - .05;
    controls.enableRotate = false;
    controls.enablePan = true;
    if (controls.mouseButtons) controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    stageShell.classList.add('wall-gallery-active');
    wallOverviewPose = wallOverviewDestination();
    onWallChange({ mode: 'overview' });
    flyCamera(wallOverviewPose, 1350);
  }

  function focusWallArt(art) {
    if (!art?.id) return;
    if (!wallMode) enterWallGallery();
    if (!wallFocusedId) {
      wallOverviewPose = { position: camera.position.clone(), target: controls.target.clone() };
      // Coming directly from the easels uses the full-wall overview as return pose.
      if (camera.position.y < wallBounds.minY - 1) wallOverviewPose = wallOverviewDestination();
    }
    wallFocusedId = art.id;
    wallArtwork = art;
    onWallChange({ mode: 'art', art });
    flyCamera(wallArtDestination(art), 1200);
  }

  function leaveWallArt() {
    if (!wallMode || !wallFocusedId) return;
    wallFocusedId = null;
    wallArtwork = null;
    onWallChange({ mode: 'overview' });
    flyCamera(wallOverviewPose || wallOverviewDestination(), 940);
  }

  function leaveWallGallery({ immediate = false } = {}) {
    if (!wallMode) return;
    wallMode = false;
    wallFocusedId = null;
    wallArtwork = null;
    onWallChange({ mode: 'closed' });
    const destination = wallOriginPose || {
      position: new THREE.Vector3(0, paintingCenterY + .4, overviewDistance()),
      target: new THREE.Vector3(0, paintingCenterY, 0),
    };
    const correctionY = paintingCenterY - destination.target.y;
    destination.target.y += correctionY;
    destination.position.y += correctionY;
    wallOriginPose = null;
    wallOverviewPose = null;
    const restore = () => {
      if (!originalControlLimits) return;
      const { leftButton, ...limits } = originalControlLimits;
      Object.assign(controls, limits);
      if (controls.mouseButtons && leftButton !== undefined) controls.mouseButtons.LEFT = leftButton;
      originalControlLimits = null;
      if (!cameraTravel) controls.update();
    };
    if (immediate) {
      cameraTravel = null;
      camera.position.copy(destination.position);
      controls.target.copy(destination.target);
      controls.enabled = true;
      restore();
      stageShell.classList.remove('wall-gallery-active');
    } else {
      flyCamera(destination, 1250, () => {
        if (!wallMode) stageShell.classList.remove('wall-gallery-active');
      });
      // The camera stays interpolated with controls disabled. Restoring limits
      // now also makes a rapid gallery re-entry safe.
      restore();
    }
  }

  function updateWallLayout(nextLayout) {
    wallBounds = nextLayout.bounds;
    if (!wallMode) return;
    if (wallFocusedId) {
      const moved = nextLayout.placements.find((art) => art.id === wallFocusedId);
      if (!moved) { leaveWallArt(); return; }
      wallArtwork = moved;
      flyCamera(wallArtDestination(moved), 820);
      return;
    }
    wallOverviewPose = wallOverviewDestination(cameraTravel
      ? wallOverviewPose?.target.x : controls.target.x);
    flyCamera(wallOverviewPose, 820);
  }

  function moveAlongWall(direction) {
    if (!wallMode) return;
    if (wallFocusedId) { leaveWallArt(); return; }
    const current = controls.target.x;
    const viewWidth = visibleWallWidth(camera.position.distanceTo(controls.target));
    const minX = (wallBounds.minX ?? -wallBounds.width / 2) + viewWidth / 2;
    const maxX = (wallBounds.maxX ?? wallBounds.width / 2) - viewWidth / 2;
    const wanted = THREE.MathUtils.clamp(current + direction * (wallBounds.columnWidth || 2.5) * 2.4,
      minX, maxX);
    if (Math.abs(wanted - current) < .01) return;
    const delta = wanted - current;
    wallOverviewPose = {
      position: camera.position.clone().add(new THREE.Vector3(delta, 0, 0)),
      target: controls.target.clone().add(new THREE.Vector3(delta, 0, 0)),
    };
    flyCamera(wallOverviewPose, 690);
  }

  function updateLabel(element, x, y, z) {
    labelProjection.set(x, y, z).project(camera);
    element.style.left = `${(labelProjection.x * .5 + .5) * stage.clientWidth}px`;
    element.style.top = `${(-labelProjection.y * .5 + .5) * stage.clientHeight}px`;
    element.style.transform = 'translate(-50%, -50%)';
  }

  function renderLabels() {
    if (wallMode) return;
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
      } else if (wallMode) {
        const destination = wallFocusedId ? wallArtDestination(wallArtwork)
          : wallOverviewPose || wallOverviewDestination();
        cameraTravel.toPosition.copy(destination.position);
        cameraTravel.toTarget.copy(destination.target);
      }
    } else {
      controls.enabled = true;
      if (wallMode) {
        // Keep the current wall pose instead of snapping back to the easels.
      } else if (activeFocus) {
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
    if (!cameraTravel) {
      const moved = controls.update();
      if (!wallMode) return moved;
      // The user can pan down from the exhibition. Recognize the easel area
      // and restore the workshop UI through the existing smooth return flight.
      if (controls.target.y < 2.85 && camera.position.y < 4.5) {
        leaveWallGallery();
        return true;
      }
      const clampedX = clampWallCenter(controls.target.x,
        camera.position.distanceTo(controls.target));
      const deltaX = clampedX - controls.target.x;
      const deltaY = Math.min(0, wallBounds.maxY - .4 - controls.target.y);
      if (Math.abs(deltaX) > .0001 || deltaY < -.0001) {
        camera.position.x += deltaX;
        camera.position.y += deltaY;
        controls.target.x += deltaX;
        controls.target.y += deltaY;
        camera.lookAt(controls.target);
        return true;
      }
      return moved;
    }
    const progress = Math.max(0, Math.min(1, (now - cameraTravel.started) / cameraTravel.duration));
    // Quintic smoothstep has zero velocity and acceleration at both ends.
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    camera.position.lerpVectors(cameraTravel.fromPosition, cameraTravel.toPosition, eased);
    controls.target.lerpVectors(cameraTravel.fromTarget, cameraTravel.toTarget, eased);
    camera.lookAt(controls.target);
    if (progress >= 1) {
      const onComplete = cameraTravel.onComplete;
      cameraTravel = null;
      controls.enabled = true;
      // Don't carry an old orbit delta into the first frame after arrival.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
      onComplete?.();
    }
    return true;
  }

  $('focus-exit').addEventListener('click', () => leaveFocus());
  $('prev-painting').addEventListener('click', () => focusOn('original'));
  $('next-painting').addEventListener('click', () => focusOn('copy'));
  new ResizeObserver(resize).observe(stage);

  return { focusOn, leaveFocus, enterWallGallery, leaveWallGallery, focusWallArt, leaveWallArt,
    updateWallLayout, moveAlongWall, updateStepper, updateFocusedHint, setPaintingCenterY,
    renderLabels, resize, animate, isTraveling: () => Boolean(cameraTravel),
    focusedSide: () => activeFocus, lastFocusedSide: () => lastFocusedSide,
    isWallGallery: () => wallMode, focusedWallId: () => wallFocusedId };
}
