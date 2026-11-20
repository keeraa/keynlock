import { STATIONS, FIXTURE_OFFSETS, bathId } from './station-layout.js';
import { bathKeyProgress, waterDipCount } from './station-visual-state.js?v=cleaning-cues';

// Membership comes from the existing bath index.
export function bathReadiness(keys, kind, now) {
  let progress = 0;
  for (const key of keys) progress = Math.max(progress, bathKeyProgress(key, kind, now));
  return { progress, status: !keys.length ? 'empty' : progress >= 1 ? 'ready' : 'processing' };
}

export function createBathProgress(document, world, keyIndex) {
  const root = document.getElementById('bath-progress');
  const canvas = document.getElementById('world');
  const { camera, THREE } = world;
  const projected = new THREE.Vector3(), eye = new THREE.Vector3();
  const bars = STATIONS.flatMap(station => ['mud', 'rust'].map(kind => ({
    kind, id: bathId(station.id, kind),
    element: document.getElementById(`bath-progress-${kind}`),
    position: new THREE.Vector3(station.x + FIXTURE_OFFSETS[kind],
      (kind === 'mud' ? 1.19 : 1.415) + .55, station.z + .10),
  })));
  const initialTime = Date.now();
  for (const bar of bars) {
    const keys = keyIndex.bathKeys(bar.id);
    bar.ready = keys.some(key => key.bathUntil <= initialTime);
    if (bar.kind === 'mud') {
      bar.dips = new Map(keys.map(key => [key.id, {
        until: key.bathUntil, count: waterDipCount(bathKeyProgress(key, 'mud', initialTime)),
      }]));
    }
  }
  function updateWaterDips(bar, keys, now, playSound) {
    if (!bar.dips) return;
    for (const id of bar.dips.keys())
      if (!keys.some(key => key.id === id)) bar.dips.delete(id);
    for (const key of keys) {
      const count = waterDipCount(bathKeyProgress(key, 'mud', now));
      const previous = bar.dips.get(key.id);
      const last = previous?.until === key.bathUntil ? previous.count : 0;
      if (count > last && key.bathUntil > now) playSound?.('water', bar.position);
      if (!previous || last !== count || previous.until !== key.bathUntil)
        bar.dips.set(key.id, { until: key.bathUntil, count });
    }
  }
  function update(playing, playSound) {
    root.hidden = !playing;
    const now = Date.now();
    if (!playing) {
      for (const bar of bars) updateWaterDips(bar, keyIndex.bathKeys(bar.id), now);
      return;
    }
    camera.updateMatrixWorld();
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const focal = height / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const bar of bars) {
      const element = bar.element;
      eye.copy(bar.position).applyMatrix4(camera.matrixWorldInverse);
      projected.copy(bar.position).project(camera);
      const visible = eye.z < -.1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
      const keys = keyIndex.bathKeys(bar.id);
      updateWaterDips(bar, keys, now, playSound);
      const pending = keys.filter(key => key.bathUntil > now);
      const ready = keys.length > pending.length;
      if (ready && !bar.ready) playSound?.('ready', bar.position);
      bar.ready = ready;
      element.hidden = !visible || pending.length === 0;
      const status = pending.length ? 'processing' : ready ? 'ready' : 'empty';
      if (element.dataset.state !== status) element.dataset.state = status;
      if (element.hidden) continue;
      const state = bathReadiness(pending, bar.kind, now);
      const percent = Math.round(state.progress * 100);
      if (element.value !== percent) element.value = percent;
      const barWidth = Math.max(28, Math.min(116, focal * .95 / -eye.z));
      element.style.left = `${(projected.x + 1) * width / 2}px`;
      element.style.top = `${(1 - projected.y) * height / 2}px`;
      element.style.width = `${barWidth}px`;
      element.style.height = `${Math.max(4, Math.min(8, barWidth * .065))}px`;
    }
  }
  return { update };
}
