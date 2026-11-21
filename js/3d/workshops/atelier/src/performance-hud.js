// @ts-check
/** Lightweight, throttled renderer diagnostics for the workshop header. */
export function createPerformanceHUD({ fpsElement, polygonsElement }) {
  const formatPolygons = new Intl.NumberFormat('ru-RU');
  let intervalStart = 0;
  let frames = 0;

  function frame(now, triangles) {
    if (!intervalStart) intervalStart = now;
    frames++;
    const elapsed = now - intervalStart;
    if (elapsed < 700) return;
    fpsElement.textContent = String(Math.round(frames * 1000 / elapsed));
    // WebGL reports rendered triangles. These are the polygons in the 3D scene.
    polygonsElement.textContent = formatPolygons.format(triangles);
    frames = 0;
    intervalStart = now;
  }

  function pause() {
    intervalStart = 0;
    frames = 0;
  }

  return { frame, pause };
}
