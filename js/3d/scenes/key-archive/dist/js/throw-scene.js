// @ts-check
import { BENCH, WATER_BATH, FORGE } from './wash-forge-stations.js';
import { RUST_TRAY } from './rust-tray.js';
import { STATIONS, FIXTURE_OFFSETS, FORGE_SURFACE_Y, bathId } from './station-layout.js';
import { ARCHIVE_DESK, ARCHIVE_SIDE_TABLES } from './archive-ledger.js';

// What a thrown key can hit, for throw-flight.js: boxes for the furniture
// (tabletops can hold a key) and the vessels with their openings.
export const HALL_WALLS = Object.freeze({ x: 11.85, z: 22.9 });

const box = (minX, minY, minZ, maxX, maxY, maxZ, extra = {}) =>
  ({ min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ }, ...extra });

// boxes: extra world boxes {min, max} (cabinets, candle sconces, chairs…).
// hallBoxes: every solid part of the hall; the parts of tables (their top
// and legs, already a surface here) are left out.
export function createThrowScene({ boxes = [], hallBoxes = [] } = {}) {
  const solids = [];
  const vessels = [];
  for (const station of STATIONS) {
    const z = station.z;
    // The workbench slab holds keys that land on it.
    solids.push(box(station.x - BENCH.width / 2, BENCH.surfaceY - BENCH.thickness, z + BENCH.z - BENCH.depth / 2,
      station.x + BENCH.width / 2, BENCH.surfaceY, z + BENCH.z + BENCH.depth / 2, { surface: true }));

    const waterX = station.x + FIXTURE_OFFSETS.mud, waterZ = z + WATER_BATH.z;
    const water = { id: bathId(station.id, 'mud'), kind: 'mud', x: waterX, z: waterZ,
      y: WATER_BATH.lipY, radius: WATER_BATH.radius - .03 };
    const outer = WATER_BATH.radius + .05;
    vessels.push({ ...water, box: box(waterX - outer, BENCH.surfaceY, waterZ - outer,
      waterX + outer, WATER_BATH.lipY, waterZ + outer, { vessel: water.id }) });

    const trayX = station.x + FIXTURE_OFFSETS.rust, trayZ = z + .10;
    const trayTop = RUST_TRAY.base - .02 + RUST_TRAY.height;
    const tray = { id: bathId(station.id, 'rust'), kind: 'rust', x: trayX, z: trayZ, y: trayTop,
      halfX: RUST_TRAY.width / 2 - RUST_TRAY.wall, halfZ: RUST_TRAY.depth / 2 - RUST_TRAY.wall };
    vessels.push({ ...tray, box: box(trayX - RUST_TRAY.width / 2, BENCH.surfaceY, trayZ - RUST_TRAY.depth / 2,
      trayX + RUST_TRAY.width / 2, trayTop, trayZ + RUST_TRAY.depth / 2, { vessel: tray.id }) });

    const forgeX = station.x + FIXTURE_OFFSETS.forge, forgeZ = z + FORGE.z;
    const forge = { id: `${station.id}-forge`, kind: 'forge', x: forgeX, z: forgeZ, y: FORGE_SURFACE_Y,
      radius: FORGE.hearthRadius, stationId: station.id };
    vessels.push({ ...forge, box: box(forgeX - FORGE.bodyRadius, BENCH.surfaceY, forgeZ - FORGE.bodyRadius,
      forgeX + FORGE.bodyRadius, FORGE_SURFACE_Y, forgeZ + FORGE.bodyRadius, { vessel: forge.id }) });
  }
  for (const { x, z } of ARCHIVE_SIDE_TABLES) {
    solids.push(box(x - ARCHIVE_DESK.width / 2, .74, z - ARCHIVE_DESK.depth / 2,
      x + ARCHIVE_DESK.width / 2, ARCHIVE_DESK.y, z + ARCHIVE_DESK.depth / 2, { surface: true }));
  }
  solids.push(...boxes);
  const surfaces = solids.filter(solid => solid.surface);
  const partOfTable = part => surfaces.some(top =>
    part.min.x >= top.min.x - .15 && part.max.x <= top.max.x + .15 &&
    part.min.z >= top.min.z - .15 && part.max.z <= top.max.z + .15 && part.max.y <= top.max.y + .05);
  solids.push(...hallBoxes.filter(part => !partOfTable(part)));

  // For one throw: which vessels would take this key.
  function forKey(accepts) {
    return {
      // A vessel that takes the key leaves its opening free to fall through.
      solids: [...solids, ...vessels.map(({ box: shape, ...vessel }) =>
        accepts(vessel) ? { ...shape, opening: vessel } : shape)],
      vessels: vessels.map(({ box: _, ...vessel }) => ({ ...vessel, accepts: Boolean(accepts(vessel)) })),
      walls: HALL_WALLS,
    };
  }

  return { forKey, solids, vessels };
}
