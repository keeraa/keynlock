// @ts-check
import { createRoomKit } from './kit.js';
import { buildShell } from './shell.js';
import { buildWindow } from './window.js';
import { buildPlanning } from './planning.js';
import { buildWorkbench } from './workbench-furniture.js';
import { buildGramophone, buildDetails } from './details.js';
import { createWindowLight } from './window-light.js';
import { buildLamps } from './lamps.js';

/** A single continuous room, using the proportions and gouache materials of the existing ateliers. */
export function buildLair(scene, m) {
  const kit = createRoomKit(scene, m);
  const { anchors, hitTargets, animated, zoneTarget } = kit;
  // The Atelier (@keynlock/atelier, mounted by atelier-in-room.js) and the
  // laboratory (@keynlock/alchemy, mounted by alchemy-in-room.js) own all
  // their furniture; the room keeps only their picking targets.
  const rightWallFinish = buildShell(kit);
  const windowView = buildWindow(kit);
  const windowLight = createWindowLight(kit.staticGroup);
  animated.push(windowLight.update);
  zoneTarget('atelier', [-6.93, 2.28, 12.10], [3.28, 4.9, 7.20]);
  buildPlanning(kit);
  buildWorkbench(kit);
  buildGramophone(kit);
  const ambientParticles = buildDetails(kit, { windowLight });
  const lamps = buildLamps(kit);
  zoneTarget('alchemy', [6.86, 2.34, 10.10], [3.05, 5.8, 5.22]);
  const wallpapers = {
    tile: m.alchemyTile,
    ochre: m.atelierSideWall,
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
