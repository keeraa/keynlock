/** Pointer hit-testing, drag capture, tool cursor and UV spotlight. */
export function createRestorationInput({ THREE, renderer, camera, controls, scene, stage,
  leftEasel, rightEasel, navigation, getSurface, getTexture, onStrokeFinished,
  onStrokeProgress, onToolChanged, getWallArtworkHit = () => null,
  onWallArtworkClick = () => {}, onWallArtworkHover = () => {},
  onPaintingFocus = (side) => navigation.focusOn(side),
  inputElement = renderer.domElement, interactionCamera = camera,
  setStrokeInputBlocked = () => {},
  isInteractive = () => true, embeddedEditing = false, $ }) {
  let activeTool = null;
  let stroke = null;
  let pointerStart = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const frameRayPlane = new THREE.Plane();
  const frameRayNormal = new THREE.Vector3();
  const frameRayOrigin = new THREE.Vector3();
  const frameRayPoint = new THREE.Vector3();
  const toolCursor = $('restoration-cursor');
  const damageHint = $('damage-hint');
  const damageHintTitle = $('damage-hint-title');
  const damageHintAction = $('damage-hint-action');
  const uvSpotLight = new THREE.SpotLight('#8f82ff', 6.5, 2.2, .5, .89, 2);
  uvSpotLight.visible = false;
  uvSpotLight.castShadow = false;
  scene.add(uvSpotLight, uvSpotLight.target);
  const uvLightPosition = new THREE.Vector3();
  const uvLightTarget = new THREE.Vector3();

  function updateUVIllumination(hit) {
    const surface = getSurface();
    const isLit = activeTool === 'uv' && !!surface && !navigation.isTraveling() && hit?.side === 'copy';
    surface?.setUVPointer(isLit ? hit.uv : null);
    uvSpotLight.visible = Boolean(isLit);
    if (!isLit) return;
    const { width, height } = rightEasel.paintingMesh.geometry.parameters;
    const x = (hit.uv.x - .5) * width;
    const y = (hit.uv.y - .5) * height;
    rightEasel.artwork.updateWorldMatrix(true, false);
    uvLightPosition.set(x + .13, y - .1, 1.02);
    uvLightTarget.set(x, y, .18);
    uvSpotLight.position.copy(rightEasel.artwork.localToWorld(uvLightPosition));
    uvSpotLight.target.position.copy(rightEasel.artwork.localToWorld(uvLightTarget));
    uvSpotLight.target.updateMatrixWorld();
  }

  function paintingHit(event) {
    if (!getTexture() || !leftEasel.paintingMesh || !rightEasel.paintingMesh) return null;
    const bounds = inputElement.getBoundingClientRect();
    pointer.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1,
    );
    raycaster.setFromCamera(pointer, interactionCamera);
    const hits = raycaster.intersectObjects([leftEasel.paintingMesh, rightEasel.paintingMesh], false);
    if (!hits.length) return null;
    return { side: hits[0].object === leftEasel.paintingMesh ? 'original' : 'copy', uv: hits[0].uv };
  }

  // Continue a held stroke across the narrow frame, clamping to the closest
  // canvas edge while keeping OrbitControls from taking over the pointer.
  function copyFrameHit() {
    const paintingMesh = rightEasel.paintingMesh;
    if (!paintingMesh) return null;
    paintingMesh.updateWorldMatrix(true, false);
    paintingMesh.getWorldPosition(frameRayOrigin);
    frameRayNormal.set(0, 0, 1).transformDirection(paintingMesh.matrixWorld);
    frameRayPlane.setFromNormalAndCoplanarPoint(frameRayNormal, frameRayOrigin);
    if (!raycaster.ray.intersectPlane(frameRayPlane, frameRayPoint)) return null;
    paintingMesh.worldToLocal(frameRayPoint);
    const { width, height } = paintingMesh.geometry.parameters;
    const margin = .18;
    if (Math.abs(frameRayPoint.x) > width / 2 + margin || Math.abs(frameRayPoint.y) > height / 2 + margin) return null;
    return {
      side: 'copy',
      uv: new THREE.Vector2(
        THREE.MathUtils.clamp(frameRayPoint.x / width + .5, .002, .998),
        THREE.MathUtils.clamp(frameRayPoint.y / height + .5, .002, .998),
      ),
    };
  }

  function updateToolCursor(event, hit) {
    const surface = getSurface();
    const visible = !!(activeTool && hit?.side === 'copy' && !navigation.isTraveling());
    const inspectable = !!(surface && hit?.side === 'copy' && !navigation.isTraveling());
    updateUVIllumination(visible ? hit : null);
    toolCursor.hidden = !visible;
    toolCursor.classList.toggle('is-working', Boolean(stroke));
    damageHint.hidden = !inspectable;
    if (!visible && !inspectable) return;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (visible) {
      toolCursor.style.left = `${x}px`;
      toolCursor.style.top = `${y}px`;
      toolCursor.dataset.tool = activeTool;
    }
    if (inspectable) {
      const damage = surface.inspect(hit.uv);
      damageHint.dataset.damage = damage.type;
      damageHint.dataset.match = String(!!(damage.tool && activeTool === damage.tool));
      damageHintTitle.textContent = damage.title;
      damageHintAction.textContent = damage.action;
      damageHint.style.left = `${Math.max(8, Math.min(bounds.width - 220, x + (x > bounds.width - 240 ? -225 : 22)))}px`;
      damageHint.style.top = `${Math.max(8, y > bounds.height - 85 ? y - 65 : y + 22)}px`;
    }
  }

  function finishStroke(event) {
    if (!stroke || (event && event.pointerId !== stroke.pointerId)) return false;
    const finished = stroke;
    stroke = null;
    setStrokeInputBlocked(false);
    toolCursor.classList.remove('is-working');
    try { inputElement.releasePointerCapture(finished.pointerId); } catch {}
    if (finished.affected) onStrokeFinished();
    return true;
  }

  function selectTool(nextTool) {
    finishStroke();
    updateUVIllumination(null);
    activeTool = activeTool === nextTool ? null : nextTool;
    document.querySelectorAll('.restoration-tool').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tool === activeTool));
    });
    controls.enableRotate = true;
    getSurface()?.setTool(activeTool);
    toolCursor.hidden = true;
    inputElement.style.cursor = activeTool ? 'crosshair' : 'grab';
    onToolChanged();
    if (navigation.focusedSide()) navigation.updateFocusedHint();
    if (activeTool && !embeddedEditing && navigation.focusedSide() !== 'copy') navigation.focusOn('copy');
  }

  // Capture strokes before OrbitControls rotates the room.
  inputElement.addEventListener('pointerdown', (event) => {
    if (!isInteractive()) return;
    if (event.button !== 0) return;
    const hit = paintingHit(event);
    const surface = getSurface();
    if (activeTool && surface && !navigation.isTraveling() && hit?.side === 'copy') {
      pointerStart = null;
      stroke = { pointerId: event.pointerId, previousUv: hit.uv.clone(), affected: false,
        outside: false, lastTime: event.timeStamp, lastAngle: null, lastHudUpdate: event.timeStamp };
      // The Lair's OrbitControls sees pointerdown first. Suppress the camera
      // during a brush stroke, then restore its free orbit on pointerup.
      setStrokeInputBlocked(true);
      stroke.affected = surface.apply(activeTool, hit.uv);
      inputElement.setPointerCapture(event.pointerId);
      if (activeTool === 'reagent' && !stroke.affected) {
        $('restoration-description').textContent = 'Сначала найдите этот участок УФ-фонарём';
      }
      updateToolCursor(event, hit);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    pointerStart = { x: event.clientX, y: event.clientY };
    if (activeTool) inputElement.style.cursor = 'grabbing';
  }, true);

  inputElement.addEventListener('pointermove', (event) => {
    if (!isInteractive()) return;
    const painting = paintingHit(event);
    const hit = stroke && painting?.side !== 'copy' ? copyFrameHit() || painting : painting;
    if (stroke && event.pointerId === stroke.pointerId) {
      if (hit?.side === 'copy') {
        let strength = .35;
        if (activeTool === 'swab' && stroke.previousUv) {
          const dx = (hit.uv.x - stroke.previousUv.x) * 640;
          const dy = (hit.uv.y - stroke.previousUv.y) * 640;
          const speed = Math.hypot(dx, dy) / Math.max(12, event.timeStamp - stroke.lastTime);
          const slow = THREE.MathUtils.clamp(1 - speed / 1.5, 0, 1);
          const angle = Math.atan2(dy, dx);
          const change = stroke.lastAngle === null ? 0 : Math.abs(Math.atan2(
            Math.sin(angle - stroke.lastAngle), Math.cos(angle - stroke.lastAngle)));
          const curve = THREE.MathUtils.clamp(change / 1.35, 0, 1);
          strength = .23 + .38 * slow + .39 * curve;
          if (Math.hypot(dx, dy) > .1) stroke.lastAngle = angle;
        }
        stroke.affected = getSurface().apply(activeTool, hit.uv, stroke.previousUv, strength) || stroke.affected;
        stroke.lastTime = event.timeStamp;
        if (stroke.previousUv) stroke.previousUv.copy(hit.uv);
        else stroke.previousUv = hit.uv.clone();
        if (stroke.affected && event.timeStamp - stroke.lastHudUpdate > 130) {
          onStrokeProgress();
          stroke.lastHudUpdate = event.timeStamp;
        }
        stroke.outside = false;
      } else {
        stroke.previousUv = null;
        stroke.lastAngle = null;
        if (!stroke.outside) {
          $('restoration-description').textContent = 'Кнопка зажата — продолжите обработку, вернувшись на картину';
        }
        stroke.outside = true;
      }
      updateToolCursor(event, hit);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    updateToolCursor(event, hit);
    const wallHit = !stroke && !navigation.isTraveling() && !hit ? getWallArtworkHit(event) : null;
    onWallArtworkHover(wallHit, event);
    if (!pointerStart) inputElement.style.cursor = wallHit ? 'pointer'
      : activeTool && hit?.side === 'copy' ? embeddedEditing ? 'crosshair' : 'none' : hit ? 'zoom-in' : 'grab';
  }, true);

  inputElement.addEventListener('pointercancel', (event) => {
    if (!isInteractive()) return;
    if (finishStroke(event)) event.stopImmediatePropagation();
    pointerStart = null;
    toolCursor.hidden = true;
    damageHint.hidden = true;
    updateUVIllumination(null);
  }, true);
  inputElement.addEventListener('lostpointercapture', (event) => finishStroke(event), true);
  inputElement.addEventListener('pointerup', (event) => {
    if (!isInteractive()) return;
    if (finishStroke(event)) { event.stopImmediatePropagation(); return; }
    if (!pointerStart) return;
    const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    const hit = paintingHit(event);
    const wallHit = !hit && !navigation.isTraveling() ? getWallArtworkHit(event) : null;
    inputElement.style.cursor = wallHit ? 'pointer' : activeTool && hit?.side === 'copy' ? embeddedEditing ? 'crosshair' : 'none' : hit ? 'zoom-in' : 'grab';
    if (moved <= 7 && hit?.side) onPaintingFocus(hit.side);
    else if (moved <= 7 && wallHit) onWallArtworkClick(wallHit);
  }, true);
  inputElement.addEventListener('pointerleave', () => {
    if (!isInteractive()) return;
    if (!stroke) toolCursor.hidden = true;
    damageHint.hidden = true;
    updateUVIllumination(null);
    onWallArtworkHover(null);
  });
  document.querySelectorAll('.restoration-tool').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  });

  return { selectTool, finishStroke, clearUV: () => updateUVIllumination(null),
    hide: () => { toolCursor.hidden = true; damageHint.hidden = true; },
    setSurface: (surface) => { surface?.setTool(activeTool); uvSpotLight.visible = false; },
    currentTool: () => activeTool };
}
