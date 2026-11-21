// @ts-check
import { createRoomKit } from './kit.js';
import { buildShell } from './shell.js';
import { buildWindow } from './window.js';
import { buildPlanning } from './planning.js';
import { buildWorkbench } from './workbench-furniture.js';
import { buildGramophone, buildDetails } from './details.js';
import { createWindowLight } from './window-light.js';
import { buildLamps } from './lamps.js';
import { mergeStaticMeshes } from '../../../../core/rendering/merge-static.js';
import { ALCHEMY_Z, ATELIER_Z } from '../room-layout.js';

/** A single continuous room, using the proportions and gouache materials of the existing ateliers. */
export function buildLair(scene, m) {
  const kit = createRoomKit(scene, m);
  const { anchors, hitTargets, animated, zoneTarget } = kit;
  // The Atelier and the laboratory, mounted by their packages, own all
  // their furniture; the room keeps only their picking targets.
  const rightWallFinish = buildShell(kit);
  const windowView = buildWindow(kit);
  zoneTarget('atelier', [-6.93, 2.28, ATELIER_Z + 1.75], [3.28, 4.9, 7.20]);
  const planningFurniture = buildPlanning(kit);
  buildWorkbench(kit, rightWallFinish.position.x);
  const gramophoneTable = buildGramophone(kit);
  const windowLight = createWindowLight(kit.staticGroup, [...planningFurniture, gramophoneTable]);
  animated.push(windowLight.update);
  const ambientParticles = buildDetails(kit, { windowLight });
  const lamps = buildLamps(kit);
  zoneTarget('alchemy', [6.86, 1.15, ALCHEMY_Z], [3.05, 2.3, 5.22]);
  // Hundreds of small static parts become a few meshes (draw calls).
  mergeStaticMeshes(kit.staticGroup);
  const wallpapers = {
    tile: m.alchemyTile,
    ochre: m.wallpaperOchre,
    botanical: m.wallpaperBotanical,
    damask: m.wallpaperDamask,
  };
  return {
    anchors, hitTargets, animated, ambientParticles, windowLight,
    /**
     * 0 = day: warm sun through the window, dim lamps. 1 = night: moonlight, a
     * dark city outside and the lamps as the main light. In between while it changes.
     */
    setNight(/** @type {number | boolean} */ night) {
      windowView.setNight(night);
      windowLight.setNight(night);
      lamps.setNight(night);
    },
    setRightWallpaper(name) {
      if (!Object.hasOwn(wallpapers, name) || !rightWallFinish) return false;
      rightWallFinish.material = wallpapers[name];
      return true;
    },
  };
}
