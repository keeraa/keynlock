/** Navigation state: easels → focused painting → wall overview → wall artwork. */
import { createCameraFraming } from './navigation/camera-framing.js';
import { createCameraTransition } from '../../../core/navigation/camera-transition.js';
import { createEaselOverlay } from './navigation/easel-overlay.js';

const MODES = Object.freeze({ EASELS: 'easels', FOCUS: 'focus', GALLERY: 'gallery', ART: 'art' });

export function createSceneNavigation({ THREE, camera, controls, renderer, stage, easelX,
  cartoonFilter, labelLayer, getTexture, getTool, clearUV, damageHint,
  easelOffsetZ = 0, onWallChange = () => {}, $ }) {
  let paintingCenterY = 1.91;
  let activeFocus = null;
  let lastFocusedSide = 'copy';
  let overviewPose = null;
  let mode = MODES.EASELS;
  let wallFocusedId = null;
  let wallArtwork = null;
  let wallOriginPose = null;
  let wallOverviewPose = null;
  let wallBounds = { minX: -15, maxX: 15, minY: 3.695, maxY: 11.85,
    width: 30, columnWidth: 2.5 };
  let originalControlLimits = null;
  let stageWidth = 0, stageHeight = 0;
  const inWallMode = () => mode === MODES.GALLERY || mode === MODES.ART;
  const overlay = createEaselOverlay({ THREE, camera, stage, easelX, labelLayer,
    getPaintingCenterY: () => paintingCenterY, getTexture, getTool, inWallMode, $ });
  const { stageShell } = overlay;
  const framing = createCameraFraming({ THREE, camera, controls, easelX,
    getPaintingCenterY: () => paintingCenterY, getWallBounds: () => wallBounds,
    easelOffsetZ });
  const flight = createCameraTransition({ camera, controls, onStart: () => {
    clearUV();
    damageHint.hidden = true;
  } });

  function focusOn(side) {
    if (inWallMode() || !getTexture() || (side !== 'original' && side !== 'copy') || activeFocus === side) return;
    lastFocusedSide = side;
    const changingSide = mode === MODES.FOCUS;
    if (!changingSide) overviewPose = { position: camera.position.clone(), target: controls.target.clone() };
    activeFocus = side;
    mode = MODES.FOCUS;
    controls.minDistance = 1.12;
    overlay.enterFocus(side);
    flight.start(framing.easelFocus(side, changingSide));
  }

  function resetFocusUI() {
    clearUV();
    damageHint.hidden = true;
    activeFocus = null;
    mode = MODES.EASELS;
    controls.minDistance = 5.25;
    overlay.leaveFocus();
  }

  function leaveFocus({ immediate = false } = {}) {
    if (mode !== MODES.FOCUS) return;
    resetFocusUI();
    const destination = overviewPose || framing.easelOverview();
    const offsetY = paintingCenterY - destination.target.y;
    destination.target.y = paintingCenterY;
    destination.position.y += offsetY;
    overviewPose = null;
    if (immediate) {
      flight.cancel();
      camera.position.copy(destination.position);
      controls.target.copy(destination.target);
      controls.update();
    } else flight.start(destination);
  }

  function setPaintingCenterY(next) {
    paintingCenterY = next;
    if (mode !== MODES.EASELS) return;
    const offsetY = paintingCenterY - controls.target.y;
    controls.target.y = paintingCenterY;
    camera.position.y += offsetY;
    controls.update();
  }

  function enterWallGallery(bounds = wallBounds) {
    if (inWallMode()) return;
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
    mode = MODES.GALLERY;
    controls.minDistance = 1.35;
    controls.maxDistance = framing.galleryDistance() * 1.18;
    controls.minPolarAngle = .05;
    controls.maxPolarAngle = Math.PI - .05;
    controls.enableRotate = false;
    controls.enablePan = true;
    if (controls.mouseButtons) controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    stageShell.classList.add('wall-gallery-active');
    wallOverviewPose = framing.galleryOverview();
    onWallChange({ mode: 'overview' });
    flight.start(wallOverviewPose, 1350);
  }

  function focusWallArt(art) {
    if (!art?.id) return;
    if (!inWallMode()) enterWallGallery();
    if (!wallFocusedId) {
      wallOverviewPose = { position: camera.position.clone(), target: controls.target.clone() };
      // Coming directly from the easels uses the full-wall overview as return pose.
      if (camera.position.y < wallBounds.minY - 1) wallOverviewPose = framing.galleryOverview();
    }
    mode = MODES.ART;
    wallFocusedId = art.id;
    wallArtwork = art;
    onWallChange({ mode: 'art', art });
    flight.start(framing.galleryArtwork(art), 1200);
  }

  function leaveWallArt() {
    if (mode !== MODES.ART || !wallFocusedId) return;
    mode = MODES.GALLERY;
    wallFocusedId = null;
    wallArtwork = null;
    onWallChange({ mode: 'overview' });
    flight.start(wallOverviewPose || framing.galleryOverview(), 940);
  }

  function leaveWallGallery({ immediate = false } = {}) {
    if (!inWallMode()) return;
    mode = MODES.EASELS;
    wallFocusedId = null;
    wallArtwork = null;
    onWallChange({ mode: 'closed' });
    const destination = wallOriginPose || framing.easelOverview();
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
      if (!flight.isTraveling()) controls.update();
    };
    if (immediate) {
      flight.cancel();
      camera.position.copy(destination.position);
      controls.target.copy(destination.target);
      restore();
      stageShell.classList.remove('wall-gallery-active');
    } else {
      flight.start(destination, 1250, () => {
        if (!inWallMode()) stageShell.classList.remove('wall-gallery-active');
      });
      // The camera stays interpolated with controls disabled. Restoring limits
      // now also makes a rapid gallery re-entry safe.
      restore();
    }
  }

  function updateWallLayout(nextLayout) {
    const previousBounds = wallBounds;
    wallBounds = nextLayout.bounds;
    if (!inWallMode()) return;
    if (wallFocusedId) {
      const moved = nextLayout.placements.find((art) => art.id === wallFocusedId);
      if (!moved) { leaveWallArt(); return; }
      const previous = wallArtwork;
      wallArtwork = moved;
      if (!previous || ['x', 'y', 'width', 'height'].some((key) =>
        Math.abs(previous[key] - moved[key]) > .001)) {
        const destination = framing.galleryArtwork(moved);
        if (flight.isTraveling()) flight.retarget(destination);
        else flight.start(destination, 820);
      }
      return;
    }
    if (previousBounds.minX === wallBounds.minX && previousBounds.maxX === wallBounds.maxX &&
      previousBounds.minY === wallBounds.minY && previousBounds.maxY === wallBounds.maxY) return;
    wallOverviewPose = framing.galleryOverview(flight.isTraveling()
      ? wallOverviewPose?.target.x : controls.target.x);
    if (flight.isTraveling()) flight.retarget(wallOverviewPose);
    else flight.start(wallOverviewPose, 820);
  }

  function moveAlongWall(direction) {
    if (!inWallMode()) return;
    if (mode === MODES.ART) { leaveWallArt(); return; }
    const fromPose = flight.isTraveling() && wallOverviewPose
      ? wallOverviewPose : { position: camera.position, target: controls.target };
    wallOverviewPose = framing.galleryStep(direction, fromPose);
    if (Math.abs(wallOverviewPose.target.x - fromPose.target.x) < .01) return;
    flight.start(wallOverviewPose, 690);
  }

  // The Lair renders this camera in its own canvas. Feed horizontal pointer
  // drags back into the original gallery rig so the wall stays navigable.
  function panAlongWall(viewportFraction) {
    if (mode !== MODES.GALLERY || !Number.isFinite(viewportFraction)) return;
    const source = flight.isTraveling() && wallOverviewPose
      ? wallOverviewPose : { position: camera.position, target: controls.target };
    const distance = source.position.distanceTo(source.target);
    const width = framing.galleryVisibleWidth(distance);
    const nextX = framing.clampGalleryX(source.target.x + viewportFraction * width, distance);
    const change = nextX - source.target.x;
    if (Math.abs(change) < .001) return;
    wallOverviewPose = { position: source.position.clone().add(new THREE.Vector3(change, 0, 0)),
      target: source.target.clone().add(new THREE.Vector3(change, 0, 0)) };
    flight.cancel();
    camera.position.copy(wallOverviewPose.position);
    controls.target.copy(wallOverviewPose.target);
    camera.lookAt(controls.target);
    controls.update();
  }

  function zoomWall(deltaY) {
    if (mode !== MODES.GALLERY || !Number.isFinite(deltaY)) return;
    const source = flight.isTraveling() && wallOverviewPose
      ? wallOverviewPose : { position: camera.position, target: controls.target };
    const direction = source.position.clone().sub(source.target).normalize();
    const distance = THREE.MathUtils.clamp(source.position.distanceTo(source.target)
      * Math.exp(deltaY * .001), controls.minDistance, controls.maxDistance);
    flight.cancel();
    controls.target.copy(source.target);
    camera.position.copy(source.target).addScaledVector(direction, distance);
    framing.clampGalleryPose();
    controls.update();
    wallOverviewPose = { position: camera.position.clone(), target: controls.target.clone() };
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
    if (inWallMode()) controls.maxDistance = framing.galleryDistance() * 1.18;
    if (flight.isTraveling()) {
      // ResizeObserver can fire while focus controls change layout. Preserve
      // the running interpolation and adjust only its destination.
      if (mode === MODES.FOCUS) {
        flight.retarget(framing.easelFocus(activeFocus));
      } else if (inWallMode()) {
        const destination = mode === MODES.ART ? framing.galleryArtwork(wallArtwork)
          : framing.galleryOverview(wallOverviewPose?.target.x);
        if (mode === MODES.GALLERY) wallOverviewPose = destination;
        flight.retarget(destination);
      }
    } else {
      controls.enabled = true;
      if (inWallMode()) {
        // Preserve the user's pan while re-clamping the now-visible wall edges.
        if (mode === MODES.GALLERY && camera.position.distanceTo(controls.target) > controls.maxDistance) {
          wallOverviewPose = framing.galleryOverview(controls.target.x);
          flight.start(wallOverviewPose, 560);
        } else framing.clampGalleryPose();
      } else if (mode === MODES.FOCUS) {
        const centerX = activeFocus === 'original' ? -easelX : easelX;
        const offsetX = centerX - controls.target.x;
        controls.target.x = centerX;
        camera.position.x += offsetX;
      } else {
        const destination = framing.easelOverview();
        camera.position.copy(destination.position);
        controls.target.copy(destination.target);
      }
      if (!flight.isTraveling()) controls.update();
    }
    renderer.setSize(w, h);
    cartoonFilter.resize(w, h);
    overlay.renderLabels();
  }

  function animate(now) {
    if (!flight.isTraveling()) {
      const moved = controls.update();
      if (!inWallMode()) return moved;
      // The user can pan down from the exhibition. Recognize the easel area
      // and restore the workshop UI through the existing smooth return flight.
      if (controls.target.y < 2.85 && camera.position.y < 4.5) {
        leaveWallGallery();
        return true;
      }
      return framing.clampGalleryPose() || moved;
    }
    return flight.update(now);
  }

  $('focus-exit').addEventListener('click', () => leaveFocus());
  $('prev-painting').addEventListener('click', () => focusOn('original'));
  $('next-painting').addEventListener('click', () => focusOn('copy'));
  new ResizeObserver(resize).observe(stage);

  return { focusOn, leaveFocus, enterWallGallery, leaveWallGallery, focusWallArt, leaveWallArt,
    updateWallLayout, moveAlongWall, panAlongWall, zoomWall,
    updateStepper: () => overlay.updateStepper(activeFocus),
    updateFocusedHint: overlay.updateFocusedHint, setPaintingCenterY,
    renderLabels: overlay.renderLabels, resize, animate, isTraveling: flight.isTraveling,
    focusPose: side => framing.easelFocus(side, mode === MODES.FOCUS),
    easelOverviewPose: () => framing.easelOverview(),
    focusedSide: () => activeFocus, lastFocusedSide: () => lastFocusedSide,
    isWallGallery: inWallMode, focusedWallId: () => wallFocusedId,
    isWallZoomedIn: () => inWallMode()
      && camera.position.distanceTo(controls.target) < framing.galleryDistance() * .82,
    mode: () => mode };
}
