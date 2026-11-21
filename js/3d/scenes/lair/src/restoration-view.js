import { getWorkshopApi } from '../../../core/host/workshop-host.js';
import * as THREE from 'three';
import { createCameraTransition } from '@keynlock/atelier/src/navigation/camera-transition.js';
import { t } from './i18n.js';

export function createRestorationView({
  camera, controls, canvas, interaction, rendererHost, atelierFilter, host, easelPose, roomMinDistance, navigation,
}) {
  // The Atelier publishes its gallery and restoration controls once it has loaded.
  const atelierGallery = () => getWorkshopApi('restoration')?.gallery;
  const atelierBridge = () => getWorkshopApi('restoration')?.bridge;
  const galleryEntry = document.querySelector('#wall-collection-entry');
  const galleryControls = document.querySelector('#lair-gallery-controls');
  const artworkInfoPanel = document.querySelector('#restoration-art-info');
  const easelLabels = document.querySelector('#lair-easel-labels');
  const easelCameraControls = document.querySelector('#lair-easel-camera-controls');
  const galleryHover = document.querySelector('#lair-wall-art-hover');
  // Below the original salon's thirty frames on the left wall of the Lair.
  const galleryWallAnchor = new THREE.Vector3(-8.10, 3.35, 15.90);
  const atelierFlight = createCameraTransition({ camera, controls });
  let queuedGallery = false;
  let galleryActive = false;
  let galleryDrag = null;
  let artworkInfoKey = null;
  let easelFocusSide = null;
  let savedEaselView = null;
  let atelierFovTravel = null;

  function focusArtwork({side, position, target, fov}) {
    if (!navigation.isRestoring() || galleryActive) return;
    const destination = { position: new THREE.Vector3(...position), target: new THREE.Vector3(...target) };
    if (!easelFocusSide) {
      savedEaselView = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
    } else {
      // A/D and the arrow buttons preserve the visitor's zoom when switching
      // between original and restoration, like the original Atelier framing.
      destination.position.copy(destination.target).add(camera.position.clone().sub(controls.target));
    }
    easelFocusSide = side;
    controls.minDistance = 1.12;
    startAtelierFlight(destination, fov, 780);
  }

  function focusEasels() {
    if (!navigation.isRestoring() || galleryActive) return;
    const destination = savedEaselView || {
      position: new THREE.Vector3(...easelPose.position),
      target: new THREE.Vector3(...easelPose.target), fov: navigation.roomFov(),
    };
    easelFocusSide = null;
    savedEaselView = null;
    controls.minDistance = roomMinDistance;
    startAtelierFlight(destination, destination.fov, 780);
  }

  function hoverArtwork(art) {
    if (!galleryActive || !art) { galleryHover.hidden = true; return; }
    galleryHover.hidden = false;
    galleryHover.textContent = art.label;
    const bounds = interaction.getBoundingClientRect();
    galleryHover.style.left = `${Math.max(8, Math.min(bounds.width - 270, art.x - bounds.left + 17))}px`;
    galleryHover.style.top = `${Math.max(8, art.y - bounds.top - 47)}px`;
  }

  function startAtelierFlight(destination, fov, duration = 780) {
    navigation.stopApproach();
    atelierFovTravel = { from: camera.fov, to: Number.isFinite(fov) ? fov : 39,
      started: performance.now(), duration };
    atelierFlight.start(destination, duration);
  }

  function leaveGallery() {
    queuedGallery = false;
    if (!galleryActive) return;
    galleryActive = false;
    atelierFilter?.setBlurSuspended(false);
    galleryDrag = null;
    galleryHover.hidden = true;
    host.atelier.galleryActive = false;
    atelierGallery()?.leave();
    controls.enabled = true;
    interaction.style.cursor = 'grab';
    galleryControls.hidden = true;
  }

  function enterGallery() {
    const gallery = atelierGallery();
    if (!gallery || !rendererHost?.getWorldPose('restoration')) {
      queuedGallery = true;
      return;
    }
    queuedGallery = false;
    cancelFlight();
    easelFocusSide = null;
    savedEaselView = null;
    galleryActive = true;
    atelierFilter?.setBlurSuspended(true);
    navigation.stopApproach();
    host.atelier.galleryActive = true;
    controls.enabled = false;
    gallery.open(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    galleryControls.hidden = false;
    galleryEntry.hidden = true;
    interaction.style.cursor = 'grab';
  }

  function openWallGallery() {
    if (!navigation.isRestoring()) navigation.openRestoration();
    enterGallery();
  }

  function returnToEasels() {
    leaveGallery();
    navigation.openRestoration();
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    atelierBridge()?.setViewportAspect?.(w / Math.max(h, 1));
    if (galleryActive) {
      // The source gallery camera's projection is already synchronized with the
      // Lair's screen; its perspective is also used for artwork picking.
      atelierGallery()?.setAspect(w / Math.max(h, 1));
    }
  }

  function updateFlight(now) {
    const flying = atelierFlight.isTraveling();
    if (flying) atelierFlight.update(now);
    if (atelierFovTravel) {
      const t = Math.min(1, (now - atelierFovTravel.started) / atelierFovTravel.duration);
      const eased = t ** 3 * (t * (t * 6 - 15) + 10);
      camera.fov = atelierFovTravel.from + (atelierFovTravel.to - atelierFovTravel.from) * eased;
      camera.updateProjectionMatrix();
      if (t === 1) atelierFovTravel = null;
    }
    return flying;
  }

  function updateGalleryCamera() {
    // Choosing a work in the full catalogue closes the source gallery.
    // Resume the two-easel view and its restoration controls immediately.
    if (galleryActive && atelierGallery() && !atelierGallery().isActive())
      returnToEasels();
    if (galleryActive) {
      const pose = rendererHost.getWorldPose('restoration');
      if (pose) {
        camera.position.copy(pose.position);
        controls.target.copy(pose.target);
        camera.lookAt(controls.target);
        if (Math.abs(camera.fov - pose.fov) > .001) {
          camera.fov = pose.fov;
          camera.updateProjectionMatrix();
        }
      }
      const gallery = atelierGallery();
      const focusedArt = gallery?.mode() === 'art';
      document.querySelector('#gallery-art-back').hidden = !focusedArt;
      document.querySelector('.lair-gallery-panner').hidden = focusedArt;
      const sourceSwitch = document.querySelector('#atelier-embedded-app #wall-gallery-demo');
      if (sourceSwitch) document.querySelector('#gallery-switch').textContent = sourceSwitch.textContent;
      const sourceShuffle = document.querySelector('#atelier-embedded-app #wall-gallery-shuffle');
      if (sourceShuffle) document.querySelector('#gallery-shuffle').hidden = sourceShuffle.hidden;
    }
  }

  function handleGalleryKey(e) {
    if (galleryActive) {
      const collectionOpen = document.querySelector('#atelier-embedded-app #collection-modal')?.hidden === false;
      if (collectionOpen) return true;
      if (e.code === 'Escape') {
        e.preventDefault();
        returnToEasels();
        return true;
      }
      if (['ArrowLeft','KeyA','ArrowRight','KeyD'].includes(e.code)) {
        e.preventDefault();
        atelierGallery()?.step(['ArrowRight','KeyD'].includes(e.code) ? 1 : -1);
        return true;
      }
    }
    return false;
  }

  function updateRestorationArtInfo(currentZone, blocked) {
    const bridge = atelierBridge();
    const info = currentZone === 'restoration'
      ? (galleryActive ? bridge?.wallArtworkInfo?.() : bridge?.artworkInfo?.()) : null;
    const collectionOpen = document.querySelector('#atelier-embedded-app #collection-modal')?.hidden === false;
    if (!info || collectionOpen || blocked) {
      artworkInfoPanel.hidden = true;
      return;
    }
    artworkInfoPanel.hidden = false;
    const key = `${galleryActive ? 'gallery' : 'easel'}:${info.id}`;
    if (key === artworkInfoKey) return;
    artworkInfoKey = key;
    document.querySelector('#restoration-info-index').textContent = galleryActive
      ? t('КОЛЛЕКЦИЯ КАРТИН') : t('ЭКСПОНАТ № {index} / {total}', { index: String(info.index).padStart(2, '0'), total: info.total });
    document.querySelector('#restoration-info-title').textContent = info.title;
    document.querySelector('#restoration-info-author').textContent = `${info.artist} · ${info.year}`;
    document.querySelector('#restoration-info-description').textContent = info.description;
    document.querySelector('#restoration-info-ban-label').textContent = info.banLabel;
    document.querySelector('#restoration-info-ban-reason').textContent = info.banReason;
    document.querySelector('#restoration-info-policy').textContent = info.policy;
  }

  function updateRestorationEaselHUD(currentZone, overlayOpen) {
    const bridge = atelierBridge();
    const collectionOpen = document.querySelector('#atelier-embedded-app #collection-modal')?.hidden === false;
    const showing = currentZone === 'restoration' && !galleryActive && Boolean(bridge)
      && !collectionOpen && !overlayOpen;
    easelCameraControls.hidden = !showing;
    const focusedSide = showing ? bridge.focusedSide?.() : null;
    easelLabels.hidden = !showing || Boolean(focusedSide);
    if (!showing) return;
    document.querySelector('#lair-easel-camera-state').textContent = focusedSide === 'original'
      ? t('ОРИГИНАЛ') : focusedSide === 'copy' ? t('КОПИЯ') : t('СРАВНЕНИЕ');
    document.querySelector('#lair-focus-original').disabled = focusedSide === 'original';
    document.querySelector('#lair-focus-copy').disabled = focusedSide === 'copy';
    document.querySelector('#lair-focus-exit').hidden = !focusedSide;
    if (focusedSide) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    for (const entry of bridge.easelLabelPoints?.() || []) {
      const element = easelLabels.querySelector(`[data-easel-label="${entry.side}"]`);
      if (!element) continue;
      const point = new THREE.Vector3(...entry.point).project(camera);
      const visible = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < .93 && Math.abs(point.y) < .85;
      element.classList.toggle('is-offscreen', !visible);
      if (visible) {
        element.style.left = `${(point.x * .5 + .5) * width}px`;
        element.style.top = `${(-point.y * .5 + .5) * height}px`;
      }
    }
  }

  function updateGalleryEntry(currentZone) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const showEntry = !galleryActive && (currentZone === null || currentZone === 'restoration');
    if (!showEntry) { galleryEntry.hidden = true; return; }
    const point = galleryWallAnchor.clone().project(camera);
    const onScreen = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < .91 && Math.abs(point.y) < .86;
    const pinned = !onScreen && currentZone === 'restoration';
    galleryEntry.hidden = !onScreen && !pinned;
    galleryEntry.classList.toggle('pinned', pinned);
    if (onScreen) {
      galleryEntry.style.left = `${(point.x * .5 + .5) * width}px`;
      galleryEntry.style.top = `${(-point.y * .5 + .5) * height}px`;
    } else if (pinned) {
      galleryEntry.style.left = '16px';
      galleryEntry.style.top = width < 730 ? '78px' : '106px';
    }
  }

  function resetEaselFocus() {
    atelierBridge()?.resetEaselFocus?.();
    easelFocusSide = null;
    savedEaselView = null;
  }

  function cancelFlight() {
    atelierFlight.cancel();
    atelierFovTravel = null;
  }

  function updateInterface({ zone, visualOpen, overlayOpen }) {
    updateGalleryEntry(zone);
    updateRestorationArtInfo(zone, visualOpen || overlayOpen);
    updateRestorationEaselHUD(zone, overlayOpen);
  }

  function bind() {
    host.atelier.focusArtwork = focusArtwork;
    host.atelier.focusEasels = focusEasels;
    host.atelier.hoverGalleryArtwork = hoverArtwork;
    interaction.addEventListener('pointerdown', e => {
      if (galleryActive && e.button === 0) galleryDrag = { pointerId: e.pointerId, x: e.clientX };
    });
    interaction.addEventListener('pointermove', e => {
      if (!galleryActive || !galleryDrag || galleryDrag.pointerId !== e.pointerId || !(e.buttons & 1)) return;
      const delta = e.clientX - galleryDrag.x;
      galleryDrag.x = e.clientX;
      atelierGallery()?.pan(-delta / Math.max(1, canvas.clientWidth));
    });
    for (const eventName of ['pointerup','pointercancel','lostpointercapture']) {
      interaction.addEventListener(eventName, () => { galleryDrag = null; });
    }
    interaction.addEventListener('wheel', e => {
      if (!galleryActive) return;
      e.preventDefault();
      atelierGallery()?.zoom(e.deltaY);
    }, { passive: false });

    galleryEntry.addEventListener('click', openWallGallery);
    document.querySelector('#gallery-easels').addEventListener('click', returnToEasels);
    document.querySelector('#gallery-prev').addEventListener('click', () => atelierGallery()?.step(-1));
    document.querySelector('#gallery-next').addEventListener('click', () => atelierGallery()?.step(1));
    document.querySelector('#gallery-art-back').addEventListener('click', () => atelierGallery()?.backFromArt());
    document.querySelector('#gallery-switch').addEventListener('click', () => atelierGallery()?.switchDisplay());
    document.querySelector('#gallery-shuffle').addEventListener('click', () => atelierGallery()?.shuffle());
    document.querySelector('#gallery-select').addEventListener('click', () => atelierGallery()?.select());
    document.querySelector('#lair-focus-original').addEventListener('click', () =>
      atelierBridge()?.focusEasel?.('original'));
    document.querySelector('#lair-focus-copy').addEventListener('click', () =>
      atelierBridge()?.focusEasel?.('copy'));
    document.querySelector('#lair-focus-exit').addEventListener('click', () =>
      atelierBridge()?.returnToEasels?.());
    document.querySelector('#restoration-info-toggle').addEventListener('click', e => {
      const body = document.querySelector('#restoration-info-body');
      body.hidden = !body.hidden;
      e.currentTarget.textContent = body.hidden ? '+' : '−';
      e.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
      e.currentTarget.setAttribute('aria-label', body.hidden ? t('Развернуть описание картины') : t('Свернуть описание картины'));
    });
  }

  return {
    bind, resize, cancelFlight, resetEaselFocus, leaveGallery, updateFlight, updateGalleryCamera,
    updateInterface, handleGalleryKey,
    isGalleryActive: () => galleryActive,
    onReady: () => { if (queuedGallery) enterGallery(); },
  };
}
