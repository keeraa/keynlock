import * as THREE from 'three';
import { ORIGINAL_STATIONS } from './original-stations.js';
import { t } from './i18n.js';
import { ALCHEMY_LOOK } from '@keynlock/alchemy/src/look/alchemy-look.js';

export const RESTORATION_EASELS = { position: [1.56, 3.22, 10.35], target: [-7.05, 2.48, 10.35] };

const zoneDefinitions = {
  restoration: {
    number: '01', kicker: t('АТЕЛЬЕ САЙ'), title: t('Реставрация'),
    description: t('Оригинальное Ателье цвета размещено вдоль левой стены логова: 12 художественных направлений, 30 рам, действующие инструменты реставрации.'),
    status: t('Мольберты и картины находятся в общей 3D-сцене логова.'),
    link: ORIGINAL_STATIONS.restoration.sourceUrl,
    camera: RESTORATION_EASELS.position, target: RESTORATION_EASELS.target,
  },
  planning: {
    number: '02', kicker: t('БАЗА КОМАНДЫ'), title: t('Карта и дела'),
    description: t('Карта каналов и кварталов Киенлока, заметки о заказах и стол, за которым Кай, Сай и Тик готовят очередную вылазку. Сюда команда возвращается с добычей.'),
    status: t('Штаб связывает мастерские, коллекцию и будущие сюжетные задания.'),
    link: null, camera: [.15, 3.80, 7.75], target: [0, 1.75, -.7],
  },
  workbench: {
    number: '03', kicker: t('МАСТЕРСКАЯ ТИКА'), title: t('Верстак'),
    description: t('Справа от алхимического стола, вдоль зелёной стены, стоит отдельный верстак с тисками, заготовками, замочными цилиндрами и инструментальной доской.'),
    status: t('Полная исходная мастерская: опиловка, сборка замка, песочница механизмов.'),
    link: ORIGINAL_STATIONS.workbench.sourceUrl,
    camera: [1.22, 3.15, 20.07], target: [7.40, 1.68, 20.07],
  },
  alchemy: {
    number: '04', kicker: t('СОСТАВЫ И РЕАГЕНТЫ'), title: t('Алхимия'),
    description: t('Вся правая стена от пола до потолка покрыта зелёной гуашевой плиткой. У стены стоит алхимический стол с двумя ярусами, семью реагентами, пигментами, стеклом и свечами; над ним рецепт и часы.'),
    status: t('Исходная лаборатория: переливание, физика жидкостей, рецепты и все настройки.'),
    link: ORIGINAL_STATIONS.alchemy.sourceUrl,
    // Fallback only. The loaded source laboratory supplies its actual orbit
    // position, pivot and 37° field of view when entering this station.
    camera: [3.08, 4.18, 10.10], target: [6.99, 3.18, 10.10],
  },
  gramophone: {
    number: '05', kicker: t('СКРЫТАЯ КОЛЛЕКЦИЯ'), title: t('Музыка в Логове'),
    description: t('Старый граммофон хранит запрещённые иностранные пластинки. Для будущего саундтрека отобраны три исполнения ноктюрнов Шопена: Op. 9 № 2 и два варианта Op. 9 № 1.'),
    status: t('Фонотека задумана; сами записи пока не включены в опубликованную сцену.'),
    link: null, camera: [1.95, 3.38, 3.60], target: [1.96, 2.26, -3.71],
  },
};

const zoneOrder = ['restoration', 'planning', 'workbench', 'alchemy', 'gramophone'];

export function createZoneTransitions({
  scene, camera, controls, canvas, interaction, renderer, rendererHost, atelierFilter,
  originalStations, restorationView, visualUI, homePosition, homeTarget, roomMinDistance,
  roomLights,
}) {
  const zones = Object.fromEntries(Object.entries(zoneDefinitions).map(([id, zone]) => [id, { ...zone }]));
  const panel = document.querySelector('#zone-panel');
  const desiredPosition = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const roomLightDefaults = roomLights.map(light => ({ light, intensity: light.intensity, visible: light.visible }));
  const originalRoomRenderLook = {
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    shadowEnabled: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
    shadowAutoUpdate: renderer.shadowMap.autoUpdate,
  };
  let desiredFov = 47;
  let roomFov = 47;
  let currentZone = null;
  let inRoomWorkshop = null;
  let transitioning = false;
  let pendingStationOpen = null;
  let alchemyApproachDistance = 0;

  function manipulateAlchemy({ rotateX = 0, rotateY = 0, panX = 0, panY = 0, zoom = 1 } = {}) {
    if (currentZone !== 'alchemy' || transitioning) return;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= rotateX * .0055;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + rotateY * .0045, .13, Math.PI - .13);
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
    restorationView.cancelFlight();
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
    camera.fov = sourceFov;
  }

  function focus(position, target, fov = roomFov) {
    restorationView.cancelFlight();
    desiredPosition.set(...position);
    desiredTarget.set(...target);
    desiredFov = fov;
    transitioning = true;
    controls.minDistance = roomMinDistance;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  }

  function onStationReady(id) {
    if (id === 'alchemy') {
      zones.alchemy.status = t('Алхимическая лаборатория работает внутри общей сцены логова.');
      if (currentZone === 'alchemy' && pendingStationOpen === 'alchemy') {
        const pose = rendererHost?.getWorldPose('alchemy');
        if (pose) {
          alchemyApproachDistance = camera.position.distanceTo(pose.position);
          focus(pose.position.toArray(), pose.target.toArray(), pose.fov);
        }
      }
      if (inRoomWorkshop === 'alchemy') {
        applyWorldAlchemyLook(true);
        rendererHost.setWorldLighting('alchemy');
      }
      return;
    }
    if (id !== 'restoration') return;
    restorationView.resize();
    zones.restoration.status = t('Исходная реставрация встроена в логово. Картины и инструменты доступны здесь.');
    // The original painting room is rotated along the Lair's left wall. Both
    // finishes contain the same gouache image, but the Lair wall retains its
    // own independently loaded material so a slow Atelier import cannot turn
    // the visible wallpaper into a flat beige placeholder.
    const atelierWall = scene.getObjectByName('atelier-original-wallpaper');
    if (atelierWall) {
      atelierWall.visible = false;
    }
    if (inRoomWorkshop === 'restoration') rendererHost.setWorldLighting('restoration');
    restorationView.onReady();
  }

  function applyWorldAlchemyLook(enabled) {
    for (const {light,intensity,visible} of roomLightDefaults) {
      light.intensity = intensity;
      // The laboratory has its own complete lighting rig. Leaving the Lair's
      // six ambient, directional and point lights active doubles the brightness
      // and makes every lit material evaluate unnecessary light sources.
      light.visible = !enabled && visible;
    }
    // The original lab is much closer to the camera than the full Lair. Keep
    // its pixel cost bounded on retina screens, without lowering other rooms.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, enabled ? 1.35 : 1.75);
    if (Math.abs(renderer.getPixelRatio() - pixelRatio) > .001) {
      renderer.setPixelRatio(pixelRatio);
      atelierFilter?.resize(canvas.clientWidth,canvas.clientHeight,pixelRatio);
    }
    if (enabled) {
      // Both scenes already use ACES/sRGB. Changing the global shadow-map type
      // here would invalidate every material program in the large shared scene
      // and produce a multi-second shader compilation stall on station entry.
      renderer.toneMappingExposure = ALCHEMY_LOOK.renderer.exposure;
      // The original laboratory caches its mostly static 2048px shadow atlas.
      // Avoid re-rendering all workshop shadows during every Lair frame.
      renderer.shadowMap.autoUpdate = false;
    } else {
      renderer.outputColorSpace = originalRoomRenderLook.outputColorSpace;
      renderer.toneMapping = originalRoomRenderLook.toneMapping;
      renderer.toneMappingExposure = originalRoomRenderLook.toneMappingExposure;
      renderer.shadowMap.enabled = originalRoomRenderLook.shadowEnabled;
      renderer.shadowMap.type = originalRoomRenderLook.shadowType;
      renderer.shadowMap.autoUpdate = originalRoomRenderLook.shadowAutoUpdate;
    }
    renderer.shadowMap.needsUpdate = true;
  }

  function setInRoomWorkshop(id) {
    if (inRoomWorkshop === id) return;
    rendererHost.setWorldWorkshop(null);
    const ready = id && originalStations.isReady(id);
    if (id === 'alchemy' || inRoomWorkshop === 'alchemy') {
      applyWorldAlchemyLook(id === 'alchemy' && ready);
    }
    inRoomWorkshop = id;
    originalStations.setInRoomStation(id);
    document.querySelector('#app').classList.toggle('restoration-mode', id === 'restoration');
    controls.enabled = id !== 'alchemy';
    controls.minDistance = roomMinDistance;
    interaction.style.cursor = 'grab';
    rendererHost.setWorldLighting(ready ? id : null);
    rendererHost.setWorldWorkshop(id);
  }

  function openZone(id) {
    if (!zones[id]) return;
    pendingStationOpen = null;
    restorationView.leaveGallery();
    if (visualUI.isOpen()) visualUI.close();
    currentZone = id;
    const zone = zones[id];
    const hasOriginal = Boolean(ORIGINAL_STATIONS[id]);
    restorationView.resetEaselFocus();
    setInRoomWorkshop(id === 'restoration' ? id : null);
    // Restoration always starts at the two easels, regardless of the source
    // Atelier's last camera pose (which could be up at the salon gallery).
    const sourcePose = id === 'alchemy' ? rendererHost?.getWorldPose('alchemy') : null;
    const stationPosition = sourcePose?.position.toArray() || zone.camera;
    const stationTarget = sourcePose?.target.toArray() || zone.target;
    if (id === 'alchemy') alchemyApproachDistance = camera.position.distanceTo(new THREE.Vector3(...stationPosition));
    focus(stationPosition, stationTarget, sourcePose?.fov ?? (id === 'alchemy' ? 37 : roomFov));
    document.querySelector('#panel-kicker').textContent = `${zone.number} / ${zone.kicker}`;
    document.querySelector('#panel-title').textContent = zone.title;
    document.querySelector('#panel-description').textContent = zone.description;
    document.querySelector('#panel-status').textContent = zone.status;
    const link = document.querySelector('#panel-link');
    link.hidden = !zone.link;
    if (zone.link) link.href = zone.link;
    // Source geometry remains visible in the Lair during this camera flight.
    // The existing Atelier UI takes over only after the original has initialized.
    panel.hidden = hasOriginal;
    document.querySelectorAll('[data-zone]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.zone === id);
      if (btn.closest('.zone-nav')) btn.setAttribute('aria-pressed', String(btn.dataset.zone === id));
    });
    // Keep the room visible while the camera approaches the laboratory.
    if (id === 'alchemy') pendingStationOpen = id;
    else if (hasOriginal && id !== 'restoration') {
      originalStations.preload(id);
      originalStations.open(id);
    }
  }

  function closePanel() {
    pendingStationOpen = null;
    restorationView.leaveGallery();
    setInRoomWorkshop(null);
    interaction.style.cursor = 'grab';
    panel.hidden = true;
    currentZone = null;
    document.querySelectorAll('[data-zone]').forEach(button => {
      button.classList.remove('active');
      if (button.closest('.zone-nav')) button.setAttribute('aria-pressed', 'false');
    });
  }

  function resetView() {
    if (originalStations?.isOpen()) { originalStations.close(); return; }
    closePanel();
    rendererHost?.setWorldLighting(null);
    focus(homePosition.toArray(), homeTarget.toArray());
  }

  function handleKey(e) {
    if (e.defaultPrevented) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (originalStations?.isOpen()) {
      if(e.key === 'Escape')originalStations.close();
      return;
    }
    if (restorationView.handleGalleryKey(e)) return;
    // The original Atelier owns number keys 4–8 in restoration mode.
    if (currentZone === 'restoration' && /^Digit[4-8]$/.test(e.code)) return;
    if (currentZone === 'alchemy' && e.key === 'Escape' &&
        !document.querySelector('#alchemy-embedded-app #recipe-overlay')?.hidden) return;
    if (e.key === 'Escape') { if (visualUI?.isOpen()) visualUI.close(); else resetView(); return; }
    if (e.key === '0') { resetView(); return; }
    const number = Number(e.key);
    if (number >= 1 && number <= 5 && String(number) === e.key) openZone(zoneOrder[number - 1]);
  }

  function updateApproach(delta) {
    if (transitioning && !restorationView.isGalleryActive()) {
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
    const approachingAlchemy = pendingStationOpen === 'alchemy' &&
      currentZone === 'alchemy' && originalStations.isReady('alchemy') &&
      camera.position.distanceTo(desiredPosition) < alchemyApproachDistance * .55;
    if (pendingStationOpen && (!transitioning || approachingAlchemy) && currentZone === pendingStationOpen) {
      setInRoomWorkshop(pendingStationOpen);
      pendingStationOpen = null;
    }
  }

  controls.addEventListener('start', () => {
    transitioning = false;
    if (currentZone !== 'restoration' && currentZone !== 'alchemy') rendererHost.setWorldLighting(null);
  });
  document.querySelectorAll('[data-zone]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openZone(button.dataset.zone);
    });
  });
  document.querySelector('#close-panel').addEventListener('click', closePanel);
  document.querySelector('#reset-camera').addEventListener('click', resetView);
  document.addEventListener('keydown', handleKey);

  return {
    open: openZone, reset: resetView, onStationReady, resizeCamera, updateApproach,
    manipulateAlchemy, resetAlchemyCamera,
    current: () => currentZone,
    isTransitioning: () => transitioning,
    stopApproach: () => { transitioning = false; },
    roomFov: () => roomFov,
  };
}
