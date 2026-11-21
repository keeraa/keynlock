import { ALCHEMY_LOOK } from '@keynlock/alchemy/room-assets';

export function createWorkshopLighting({ scene, camera, canvas, renderer, rendererHost, atelierFilter, roomLights }) {
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
    setRoomLightsForAlchemy(enabled);
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
      // and produce a multi-second shader compilation stall on workshop entry.
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

  return { setAlchemyLook, precompile };
}
