/** Optional, low-overhead WebGL telemetry for regression testing. */
export function combineFrameStats(main, ...previews) {
  const combined = { ...main };
  for (const preview of previews) {
    if (!preview) continue;
    for (const field of ['calls', 'triangles', 'points', 'lines'])
      combined[field] = (combined[field] ?? 0) + (preview[field] ?? 0);
  }
  return combined;
}

export function createPerformanceMonitor({ enabled = false, document, window, sampleCount = 180 }) {
  if (!enabled) return { record() {}, snapshot: () => null };
  const samples = new Float32Array(sampleCount);
  let size = 0, cursor = 0, previous = 0, lastUpdate = 0;
  let current = null;
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'Производительность WebGL');
  Object.assign(overlay.style, {
    position: 'fixed', left: '12px', bottom: '12px', zIndex: '40',
    pointerEvents: 'none', whiteSpace: 'pre', padding: '9px 12px',
    background: 'rgba(8, 21, 28, .88)', color: '#d4e5e1',
    border: '1px solid rgba(182,210,221,.2)', borderRadius: '8px',
    font: '11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace',
  });
  document.body.append(overlay);

  function record(now, render = {}, memory = {}) {
    if (previous > 0) {
      const dt = now - previous;
      if (dt > 0 && dt < 500) {
        samples[cursor] = dt;
        cursor = (cursor + 1) % samples.length;
        size = Math.min(size + 1, samples.length);
      }
    }
    previous = now;
    if (now - lastUpdate < 500 || size < 2) return;
    lastUpdate = now;
    const times = Array.from(samples.subarray(0, size)).sort((a, b) => a - b);
    const average = times.reduce((sum, value) => sum + value, 0) / times.length;
    const p95 = times[Math.floor((times.length - 1) * .95)];
    current = {
      fps: Math.round(1000 / average),
      frameP95Ms: Math.round(p95 * 10) / 10,
      drawCalls: render.calls ?? 0,
      triangles: render.triangles ?? 0,
      geometries: memory.geometries ?? 0,
      textures: memory.textures ?? 0,
      frames: size,
    };
    window.__keynlockPerf = current;
    overlay.textContent = `FPS ${current.fps}  P95 ${current.frameP95Ms} ms\n` +
      `Draw ${current.drawCalls}  △ ${current.triangles}\n` +
      `Geometry ${current.geometries}  Textures ${current.textures}`;
  }
  return { record, snapshot: () => current };
}
