export function createPerformanceHud(document, world) {
  const $ = id => document.getElementById(id);
  let started = performance.now();
  let frames = 0;
  let cpuTotal = 0;
  let cpuPeak = 0;
  let callsTotal = 0;
  let passesTotal = 0;

  function sample(now, cpuMs, rendered) {
    if (rendered) {
      frames++;
      cpuTotal += cpuMs;
      cpuPeak = Math.max(cpuPeak, cpuMs);
      const stats = world.getRenderStats?.();
      callsTotal += stats?.drawCalls || 0;
      passesTotal += stats?.passes || 0;
    }
    const duration = now - started;
    if (duration < 800) return false;
    $('fps').textContent = Math.round(frames * 1000 / duration);
    $('cpu-count').textContent = frames ? `${(cpuTotal / frames).toFixed(1)} / ${cpuPeak.toFixed(1)} мс` : '—';
    $('draw-count').textContent = frames ? Math.round(callsTotal / frames).toLocaleString('ru-RU') : '2D';
    $('pass-count').textContent = frames ? (passesTotal / frames).toFixed(1) : '2D';
    const visual = world.getVisualStatus?.();
    const states = { active: 'GPU · работает', checking: 'GPU · проверка',
      error: 'GPU · ошибка', off: 'отключён', canvas: 'Canvas 2D' };
    $('visual-status').textContent = states[visual?.mode] || '—';
    const stageNames = { toon: 'Мультяшный свет', outline: 'Контур' };
    const stageStates = { active: 'работает', checking: 'проверка', error: 'ошибка', off: 'выключен' };
    $('visual-status').title = [
      ...Object.entries(visual?.stages || {}).map(([name, state]) =>
        `${stageNames[name] || name}: ${stageStates[state] || state}`),
      visual?.error,
    ].filter(Boolean).join('\n');
    const geometry = world.getGeometryStats?.();
    $('poly-count').textContent = geometry ? geometry.polygons.toLocaleString('ru-RU') : '2D';
    $('triangle-count').textContent = geometry ? geometry.triangles.toLocaleString('ru-RU') : '2D';
    started = now;
    frames = cpuTotal = cpuPeak = callsTotal = passesTotal = 0;
    return true;
  }
  return { sample };
}
