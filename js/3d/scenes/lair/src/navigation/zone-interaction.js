import * as THREE from 'three';

const HOTSPOT_HEIGHT = {
  atelier: 1.35, planning: .55, workbench: .54, alchemy: .42, gramophone: .34,
};

/** Connect room picking and projected labels to the current navigation mode. */
export function mountZoneInteraction({ canvas, camera, interaction, anchors, hitTargets, roomWalk,
  cameraInput, zoneTransitions, workshopOverlay }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const point = new THREE.Vector3();
  const hotspots = [...document.querySelectorAll('.hotspot')];
  let startPointer = null;
  let hoveredZone = null;

  function hitZone(event) {
    if (event) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    } else pointer.set(0, 0);
    raycaster.far = event ? Infinity : 4.5;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    return hit?.object?.userData?.zone || null;
  }

  function openWalkTarget() {
    const id = hitZone();
    if (id) zoneTransitions.open(id);
  }

  function update(currentZone) {
    if (cameraInput.isWalking()) {
      camera.updateMatrixWorld();
      roomWalk.setTarget(zoneTransitions.title(hitZone()));
      return;
    }
    const width = canvas.clientWidth, height = canvas.clientHeight;
    for (const button of hotspots) {
      const id = button.dataset.zone;
      if (id === currentZone) {
        button.classList.add('offscreen');
        continue;
      }
      point.copy(anchors[id]);
      point.y += HOTSPOT_HEIGHT[id];
      point.project(camera);
      const offscreen = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.05 || Math.abs(point.y) > 1.05;
      button.classList.toggle('offscreen', offscreen);
      if (!offscreen) {
        button.style.left = `${(point.x * .5 + .5) * width}px`;
        button.style.top = `${(-point.y * .5 + .5) * height}px`;
      }
    }
  }

  const canPickZone = () => !workshopOverlay.isOpen() && cameraInput.canPickZone();
  interaction.addEventListener('pointerdown', event => { startPointer = [event.clientX, event.clientY]; });
  interaction.addEventListener('pointermove', event => {
    if (!canPickZone() || cameraInput.isWalking() || event.buttons) return;
    const id = hitZone(event);
    if (id === hoveredZone) return;
    hoveredZone = id;
    interaction.style.cursor = id ? 'pointer' : 'grab';
  });
  interaction.addEventListener('click', event => {
    if (!canPickZone() || event.metaKey) return;
    if (startPointer && Math.hypot(event.clientX - startPointer[0], event.clientY - startPointer[1]) > 7) return;
    if (cameraInput.isWalking()) {
      openWalkTarget();
      return;
    }
    const id = hitZone(event);
    if (id) zoneTransitions.open(id);
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Meta') interaction.classList.add('command-pan');
  });
  window.addEventListener('keyup', event => {
    if (event.key === 'Meta') interaction.classList.remove('command-pan');
  });
  window.addEventListener('blur', () => interaction.classList.remove('command-pan'));

  return { openWalkTarget, update };
}
