
// The open lab's background blur (core/rendering/depth-blur.js, the Atelier's):
// the strength and radius of the Atelier; the soft edge scales with the
// distance to what the camera looks at, since the lab view zooms.
const LAB_BLUR = Object.freeze({ amount: .72, radius: 6.5, near: .12, far: .42 });

export function createWorkshopLighting({ scene, camera, canvas, renderer, rendererHost, roomLights, quality = null,
  outlines = null, focusTarget = null }) {
  let labLook = false, labBlur = true;
  const labBlurPass = () => {
    const focus = focusTarget ? camera.position.distanceTo(focusTarget) : 6;
    return { amount: LAB_BLUR.amount, radius: LAB_BLUR.radius, focus, near: focus * LAB_BLUR.near, far: focus * LAB_BLUR.far };
  };
  const applyLabBlur = () => outlines?.setBackgroundBlur?.(labLook && labBlur ? labBlurPass : null);
  function setLabBlur(enabled) { labBlur = Boolean(enabled); applyLabBlur(); }
  const roomLightDefaults = roomLights.map(light => ({ light, intensity: light.intensity, visible: light.visible }));
  const originalRoomRenderLook = {
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    shadowEnabled: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
    shadowAutoUpdate: renderer.shadowMap.autoUpdate,
  };

  function setRoomLightsForAlchemy(enabled) {
    for (const {light,intensity,visible} of roomLightDefaults) {
      light.intensity = intensity;
      // The laboratory has its own complete lighting rig. Leaving the Lair's
      // six ambient, directional and point lights active doubles the brightness
      // and makes every lit material evaluate unnecessary light sources.
      light.visible = !enabled && visible;
    }
  }

  function setAlchemyLook(enabled) {
    // One set of lights for the whole Lair: the room stays lit in the lab, and
    // the lab adds only its candles and burner (see the alchemy package).
    setRoomLightsForAlchemy(false);
    // The lab is much closer to the camera than the full Lair: the quality
    // settings keep its pixel cost bounded on retina screens.
    quality?.setLabOpen(enabled);
    labLook = Boolean(enabled);
    applyLabBlur();
    if (enabled) {
      // Both scenes already use ACES/sRGB. Changing the global shadow-map type
      // here would invalidate every material program in the large shared scene
      // and produce a multi-second shader compilation stall on workshop entry.
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

  /**
   * Entering a workshop switches the room's lights for the workshop's own, and
   * Three.js keys every material's shader on the number and kind of lights. The
   * first visit used to recompile every material in the scene at once (seconds
   * of a frozen screen). This compiles those variants up front, during the
   * initial loading screen: the light state is read when compileAsync() is
   * called, so the lights are switched only for that call and restored at once.
   */
  async function precompile(isReady, currentWorkshop) {
    if (!renderer.compileAsync) return;
    const workshop = currentWorkshop();
    const lit = workshop && isReady(workshop) ? workshop : null;
    for (const id of ['alchemy', 'atelier']) {
      if (!isReady(id) || id === lit) continue;
      if (id === 'alchemy') setRoomLightsForAlchemy(true);
      rendererHost.setWorldLighting(id);
      let compiled;
      try {
        compiled = renderer.compileAsync(scene, camera);
      } finally {
        if (id === 'alchemy') setRoomLightsForAlchemy(currentWorkshop() === 'alchemy');
        rendererHost.setWorldLighting(lit);
      }
      await compiled;
    }
  }

  return { setAlchemyLook, setLabBlur, precompile };
}
