// @ts-check
import { createRoomKit } from './room/kit.js';
import { buildShell } from './room/shell.js';
import { buildWindow } from './room/window.js';
import { buildPlanning } from './room/planning.js';
import { buildWorkbench } from './room/workbench.js';
import { buildGramophone, buildDetails } from './room/details.js';

/** A single continuous room, using the proportions and gouache materials of the existing ateliers. */
export function buildLair(scene, m) {
  const kit = createRoomKit(scene, m);
  const { anchors, hitTargets, animated, station } = kit;
  // The Atelier (@keynlock/atelier, mounted by atelier-in-room.js) and the
  // laboratory (@keynlock/alchemy, mounted by alchemy-in-room.js) own all
  // their furniture; the room keeps only their picking targets.
  const rightWallFinish = buildShell(kit);
  buildWindow(kit);
  station('restoration', [-6.93, 2.28, 12.10], [3.28, 4.9, 7.20]);
  buildPlanning(kit);
  buildWorkbench(kit);
  buildGramophone(kit);
  const ambientParticles = buildDetails(kit);
  station('alchemy', [6.86, 2.34, 10.10], [3.05, 5.8, 5.22]);
  const wallpapers = {
    tile: m.alchemyTile,
    ochre: m.restorationWall,
    botanical: m.wallpaperBotanical,
    damask: m.wallpaperDamask,
  };
  return {
    anchors, hitTargets, animated, ambientParticles,
    setRightWallpaper(name) {
      if (!Object.hasOwn(wallpapers, name) || !rightWallFinish) return false;
      rightWallFinish.material = wallpapers[name];
      return true;
    },
  };
}
