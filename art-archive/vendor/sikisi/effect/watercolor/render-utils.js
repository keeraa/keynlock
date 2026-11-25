/** Restore the host renderer even when a pass fails. Scratch objects are reused. */
export function createRendererGuard(THREE, renderer) {
  const frames = [];
  let depth = 0;

  return function preserve(draw) {
    const frame = (frames[depth] ??= {
      color: new THREE.Color(),
      viewport: new THREE.Vector4(),
      scissor: new THREE.Vector4(),
    });
    const target = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace();
    const mip = renderer.getActiveMipmapLevel();
    renderer.getClearColor(frame.color);
    renderer.getViewport(frame.viewport);
    renderer.getScissor(frame.scissor);
    const alpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    const xr = renderer.xr.enabled;
    const scissorTest = renderer.getScissorTest();
    depth++;
    try {
      renderer.autoClear = true;
      renderer.xr.enabled = false;
      renderer.setScissorTest(false);
      return draw();
    } finally {
      depth--;
      renderer.setRenderTarget(target, face, mip);
      renderer.setClearColor(frame.color, alpha);
      renderer.autoClear = autoClear;
      renderer.xr.enabled = xr;
      renderer.setViewport(frame.viewport);
      renderer.setScissor(frame.scissor);
      renderer.setScissorTest(scissorTest);
    }
  };
}
