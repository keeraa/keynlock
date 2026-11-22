import * as THREE from 'three';
import { WORKSHOPS } from '../workshops/workshop-overlay.js';
import { t } from '../i18n.js';
import { createWorkshopLighting } from '../rendering/workshop-lighting.js';
import { zoneDefinitions, zoneOrder } from './zone-definitions.js';

export function createZoneTransitions({
  scene, camera, controls, canvas, interaction, renderer, rendererHost,
  workshopOverlay, atelierView, visualUI, homePosition, homeTarget, roomMinDistance,
  roomLights, cameraInput,
}) {
  const zones = Object.fromEntries(Object.entries(zoneDefinitions).map(([id, zone]) => [id, { ...zone }]));
  const panel = document.querySelector('#zone-panel');
  const desiredPosition = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const workshopLighting = createWorkshopLighting({ scene, camera, canvas, renderer, rendererHost, roomLights });
  const zoneButtons = document.querySelectorAll('[data-zone]');
  let desiredFov = 47;
  let roomFov = 47;
  let currentZone = null;
  let inRoomWorkshop = null;
  let transitioning = false;
  let pendingWorkshopOpen = null;
  let alchemyApproachDistance = 0;

  function manipulateAlchemy({ rotateX = 0, rotateY = 0, panX = 0, panY = 0, zoom = 1 } = {}) {
    if (currentZone !== 'alchemy' || transitioning) return;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    // Turn exactly like the room's OrbitControls (same direction and speed),
    // so dragging feels the same everywhere in the Lair.
    const perPixel = 2 * Math.PI * controls.rotateSpeed / Math.max(1, canvas.clientHeight);
    spherical.theta -= rotateX * perPixel;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - rotateY * perPixel, .13, Math.PI - .13);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, 2, 28);
    if (panX || panY) {
      const units = 2 * spherical.radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      controls.target.addScaledVector(right, -panX * units).addScaledVector(up, panY * units);
    }
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    camera.lookAt(controls.target);
    controls.update();
  }

  function resetAlchemyCamera() {
    if (currentZone !== 'alchemy') return;
    const pose = rendererHost.getWorldPose('alchemy');
    if (!pose) return;
    atelierView.cancelFlight();
    transitioning = false;
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
  }

  function resizeCamera(width) {
    roomFov = width < 720 ? 59 : width < 1050 ? 52 : 47;
    const sourceFov = currentZone === 'alchemy'
      ? rendererHost?.getWorldPose('alchemy')?.fov ?? 37
      : roomFov;
    desiredFov = sourceFov;
    return sourceFov;
  }

  function focus(position, target, fov = roomFov) {
    atelierView.cancelFlight();
    desiredPosition.set(...position);
    desiredTarget.set(...target);
    desiredFov = fov;
    transitioning = true;
    controls.minDistance = roomMinDistance;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  }

  function onWorkshopReady(id) {
    if (id === 'alchemy') {
      zones.alchemy.status = t('Алхимическая лаборатория работает внутри общей сцены логова.');
      if (currentZone === 'alchemy' && pendingWorkshopOpen === 'alchemy') {
        const pose = rendererHost?.getWorldPose('alchemy');
        if (pose) {
          alchemyApproachDistance = camera.position.distanceTo(pose.position);
          focus(pose.position.toArray(), pose.target.toArray(), pose.fov);
        }
      }
      if (inRoomWorkshop === 'alchemy') {
        workshopLighting.setAlchemyLook(true);
        rendererHost.setWorldLighting('alchemy');
      }
      return;
    }
    if (id !== 'atelier') return;
    atelierView.resize();
    zones.atelier.status = t('Исходная реставрация встроена в логово. Картины и инструменты доступны здесь.');
    // The original painting room is rotated along the Lair's left wall. Both
    // finishes contain the same gouache image, but the Lair wall retains its
    // own independently loaded material so a slow Atelier import cannot turn
    // the visible wallpaper into a flat beige placeholder.
    const atelierWall = scene.getObjectByName('atelier-original-wallpaper');
    if (atelierWall) {
      atelierWall.visible = false;
    }
    atelierView.onReady();
  }

  function setInRoomWorkshop(id) {
    if (inRoomWorkshop === id) return;
    rendererHost.setWorldWorkshop(null);
    const ready = id && workshopOverlay.isReady(id);
    if (id === 'alchemy' || inRoomWorkshop === 'alchemy') {
      workshopLighting.setAlchemyLook(id === 'alchemy' && ready);
    }
    inRoomWorkshop = id;
    workshopOverlay.setInRoomWorkshopId(id);
    document.querySelector('#app').classList.toggle('atelier-mode', id === 'atelier');
    controls.minDistance = roomMinDistance;
    interaction.style.cursor = 'grab';
    // The Atelier is lit by the room (one look, no jump in brightness on entry);
    // only the lab switches to its own darker lighting.
    rendererHost.setWorldLighting(ready && id !== 'atelier' ? id : null);
    rendererHost.setWorldWorkshop(id);
  }

  function selectZoneButtons(id) {
    for (const button of zoneButtons) {
      const selected = button.dataset.zone === id;
      button.classList.toggle('active', selected);
      if (button.closest('.zone-nav')) button.setAttribute('aria-pressed', String(selected));
    }
  }

  // A zone opened while walking returns to the walk, where the walker stood.
  let returnToWalk = false;

  function openZone(id) {
    if (!zones[id]) return;
    if (cameraInput.isWalking()) returnToWalk = true;
    pendingWorkshopOpen = null;
    atelierView.leaveGallery();
    if (visualUI.isOpen()) visualUI.close();
    currentZone = id;
    cameraInput.setMode(id === 'alchemy' || id === 'atelier' ? id : 'room');
    const zone = zones[id];
    const hasOriginal = Boolean(WORKSHOPS[id]);
    atelierView.resetEaselFocus();
    setInRoomWorkshop(id === 'atelier' ? id : null);
    // Restoration always starts at the two easels, regardless of the source
    // Atelier's last camera pose (which could be up at the salon gallery).
    const sourcePose = id === 'alchemy' ? rendererHost?.getWorldPose('alchemy') : null;
    const workshopPosition = sourcePose?.position.toArray() || zone.camera;
    const workshopTarget = sourcePose?.target.toArray() || zone.target;
    if (id === 'alchemy') alchemyApproachDistance = camera.position.distanceTo(new THREE.Vector3(...workshopPosition));
    focus(workshopPosition, workshopTarget, sourcePose?.fov ?? (id === 'alchemy' ? 37 : roomFov));
    document.querySelector('#panel-kicker').textContent = `${zone.number} / ${zone.kicker}`;
    document.querySelector('#panel-title').textContent = zone.title;
    document.querySelector('#panel-description').textContent = zone.description;
    document.querySelector('#panel-status').textContent = zone.status;
    const link = document.querySelector('#panel-link');
    link.hidden = !zone.link;
    if (zone.link) link.href = zone.link;
    document.querySelector('#panel-music').hidden = id !== 'gramophone';
    // Source geometry remains visible in the Lair during this camera flight.
    // The existing Atelier UI takes over only after the original has initialized.
    panel.hidden = hasOriginal;
    selectZoneButtons(id);
    // Keep the room visible while the camera approaches the laboratory.
    if (id === 'alchemy') pendingWorkshopOpen = id;
    else if (hasOriginal && id !== 'atelier') {
      workshopOverlay.preload(id);
      workshopOverlay.open(id);
    }
  }

  function closePanel(nextMode = 'room', { resumeWalk = false } = {}) {
    pendingWorkshopOpen = null;
    atelierView.leaveGallery();
    cameraInput.setMode(nextMode, { resumeWalk });
    setInRoomWorkshop(null);
    interaction.style.cursor = 'grab';
    panel.hidden = true;
    currentZone = null;
    selectZoneButtons(null);
  }

  function resetView() {
    if (workshopOverlay?.isOpen()) { workshopOverlay.close(); return; }
    if (returnToWalk && currentZone) {
      returnToWalk = false;
      transitioning = false;
      closePanel('walk', { resumeWalk: true });
      atelierView.cancelFlight();
      rendererHost?.setWorldLighting(null);
      return;
    }
    returnToWalk = false;
    closePanel();
    rendererHost?.setWorldLighting(null);
    focus(homePosition.toArray(), homeTarget.toArray());
  }

  function toggleWalk() {
    if (workshopOverlay.isOpen()) return;
    if (visualUI.isOpen()) visualUI.close();
    if (cameraInput.isWalking()) {
      resetView();
      return;
    }
    transitioning = false;
    closePanel('walk', { resumeWalk: returnToWalk });
    returnToWalk = false;
    atelierView.cancelFlight();
    rendererHost.setWorldLighting(null);
  }

  function handleKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (workshopOverlay?.isOpen()) {
      if(e.key === 'Escape')workshopOverlay.close();
      return;
    }
    // The original Atelier owns number keys 4–8 in restoration mode.
    if (currentZone === 'atelier' && /^Digit[4-8]$/.test(e.code)) return;
    if (e.key === 'Escape') { if (visualUI?.isOpen()) visualUI.close(); else resetView(); return; }
    if (e.key === '0') { resetView(); return; }
    const number = Number(e.key);
    if (number >= 1 && number <= 5 && String(number) === e.key) openZone(zoneOrder[number - 1]);
  }

  function updateApproach(delta) {
    if (transitioning && !cameraInput.isGallery()) {
      const factor = 1 - Math.exp(-4.8 * delta);
      camera.position.lerp(desiredPosition, factor);
      controls.target.lerp(desiredTarget, factor);
      if (Math.abs(camera.fov-desiredFov)>.001) {
        camera.fov += (desiredFov-camera.fov)*factor;
        camera.updateProjectionMatrix();
      }
      // Alchemy uses an independent input runtime, so OrbitControls.update()
      // is intentionally paused. Aim the Lair camera explicitly during flight.
      if (currentZone === 'alchemy') camera.lookAt(controls.target);
      if (camera.position.distanceTo(desiredPosition) < .014 && controls.target.distanceTo(desiredTarget) < .014 && Math.abs(camera.fov-desiredFov)<.06) {
        transitioning = false;
      }
    }
    // Reveal the loaded laboratory while the camera is still moving towards it.
    // During the overlay fade the room keeps rendering underneath.
    const approachingAlchemy = pendingWorkshopOpen === 'alchemy' &&
      currentZone === 'alchemy' && workshopOverlay.isReady('alchemy') &&
      camera.position.distanceTo(desiredPosition) < alchemyApproachDistance * .55;
    if (pendingWorkshopOpen && (!transitioning || approachingAlchemy) && currentZone === pendingWorkshopOpen) {
      setInRoomWorkshop(pendingWorkshopOpen);
      pendingWorkshopOpen = null;
    }
  }

  controls.addEventListener('start', () => {
    transitioning = false;
    if (currentZone !== 'atelier' && currentZone !== 'alchemy') rendererHost.setWorldLighting(null);
  });
  zoneButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openZone(button.dataset.zone);
    });
  });
  // Closing a zone's panel opened from a walk goes back to the walk too.
  document.querySelector('#close-panel').addEventListener('click', () => (returnToWalk ? resetView() : closePanel()));
  document.querySelector('#reset-camera').addEventListener('click', resetView);
  document.querySelector('#room-walk-toggle').addEventListener('click', toggleWalk);

  return {
    open: openZone, reset: resetView, onWorkshopReady, resizeCamera, updateApproach, handleKey,
    returnsToWalk: () => returnToWalk,
    precompileWorkshopLighting: () => workshopLighting.precompile(workshopOverlay.isReady, () => inRoomWorkshop),
    manipulateAlchemy, resetAlchemyCamera,
    current: () => currentZone,
    title: id => zones[id]?.title,
    isTransitioning: () => transitioning,
    stopApproach: () => { transitioning = false; },
    roomFov: () => roomFov,
  };
}
