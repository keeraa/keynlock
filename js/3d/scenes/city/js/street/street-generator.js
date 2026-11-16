import { normalizeHouseConfig, maxFrontWindows, maxSideWindows } from '../buildings/house-config.js';
import { resolveDistrictProfile } from './district-profiles.js';
import { estimateResidentCapacity } from './resident-capacity.js';

export const STREET_SCHEMA_VERSION = 1;
function rng(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}
const range = (rand, [lo, hi]) => lo + rand() * (hi - lo);
const chance = (rand, odds) => rand() < odds;
const pick = (rand, array) => array[Math.floor(rand() * array.length)];
const stepped = (rand, bounds, step) => Math.round(range(rand, bounds) / step) * step;

// Shared architectural grammar for both the linear street and full blocks.
export function generateDistrictHouseConfig(rand, profile) {
  const width = stepped(rand,profile.width,.5);
  const depth = stepped(rand,profile.depth,.5);
  const floors = Math.round(stepped(rand,profile.floors,1));
  const shutters = chance(rand,profile.details.shutters);
  const roofType = pick(rand,profile.roofs);
  return normalizeHouseConfig({
    floors,width,depth,roofType,
    roofHeight:roofType==='flat'?.7:Math.round((1.15+rand()*(roofType==='hip'?1.55:1.95))*10)/10,
    roofColor:pick(rand,profile.roofsPalette),plasterColor:pick(rand,profile.walls),woodColor:pick(rand,profile.woods),
    frontWindows:Math.min(maxFrontWindows(width,shutters),width>=9.5?5:3),
    sideWindows:Math.min(maxSideWindows(depth,shutters),depth>=8?3:2),
    shutters,chimney:chance(rand,profile.details.chimney),balcony:floors>1&&chance(rand,profile.details.balcony),
    timberFrame:chance(rand,profile.details.timberFrame),
    plasterDamage:chance(rand,profile.details.damage),damageAmount:[15,25,35,45][Math.floor(rand()*4)],
    damageScale:Math.round((.7+rand()*2.2)*10)/10,
    windowStyle:chance(rand,profile.details.arch)?'arched':'straight',
    doorStyle:chance(rand,profile.details.arch)?'arched':'straight',
  });
}

export function generateStreetPlan(districtId = 'old', seed = 1, overrides = {}) {
  const profile = resolveDistrictProfile(districtId, overrides);
  const rand = rng(seed ^ (districtId.split('').reduce((n, c) => n * 31 + c.charCodeAt(0), 7) >>> 0));
  const sides = [-1, 1];
  const houses = [];
  const counts = [5, 5];
  const laneLengths = [];
  for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
    const side = sides[sideIndex];
    const row = [];
    let length = 0;
    for (let i = 0; i < counts[sideIndex]; i++) {
      const config = generateDistrictHouseConfig(rand,profile);
      const gap = i === counts[sideIndex] - 1 ? 0 : range(rand, profile.gap) * profile.gapScale;
      const setback = range(rand, profile.setback);
      const id = `${districtId}-${side < 0 ? 'l' : 'r'}-${String(i + 1).padStart(2, '0')}`;
      row.push({id, side, index: i, config, gap, setback, frontage: config.width});
      length += config.width + gap;
    }
    let cursor = -length / 2;
    for (const item of row) {
      const z = cursor + item.frontage / 2;
      const x = item.side * (profile.roadWidth / 2 + profile.sidewalkWidth + item.setback + item.config.depth / 2 + .16);
      houses.push({...item, x, z, rotation: -item.side * Math.PI / 2});
      cursor += item.frontage + item.gap;
    }
    laneLengths.push(length);
  }
  const length = Math.ceil(Math.max(...laneLengths) + 22);
  const lamps = [];
  const lampCount = Math.max(3, Math.floor((length - 14) / profile.lampSpacing) + 1);
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sides[sideIndex];
    for (let i = 0; i < lampCount; i++) {
      const z = lampCount === 1 ? 0 : -length / 2 + 7 + i * (length - 14) / (lampCount - 1);
      lamps.push({id:`lamp-${sideIndex}-${i}`, side, x: side * (profile.roadWidth / 2 + .42), z, style: profile.lampStyle});
    }
  }
  return {
    schema: 'keynlock.street', version: STREET_SCHEMA_VERSION, district: districtId, seed: Number(seed) >>> 0,
    profile: {...profile, details:{...profile.details}, roofs:[...profile.roofs], walls:[...profile.walls], roofsPalette:[...profile.roofsPalette]},
    road: {width:profile.roadWidth, length, surface:profile.surface},
    sidewalks: {width:profile.sidewalkWidth, elevation:.22},
    lamps, houses,
    stats: {houses:houses.length, lamps:lamps.length, residents:estimateResidentCapacity(houses,districtId),
      minFloors:Math.min(...houses.map(h=>h.config.floors)),
      maxFloors:Math.max(...houses.map(h=>h.config.floors))},
  };
}

export function createStreetBlueprint(plan) {
  return {
    schema:plan.schema, version:plan.version, district:plan.district, seed:plan.seed,
    rules:plan.profile, road:plan.road, sidewalks:plan.sidewalks, lamps:plan.lamps,
    residents:plan.stats.residents,
    ...(plan.roads?{roadNetwork:plan.roads,courtyard:plan.courtyard,walkways:plan.walkways}:{}),
    buildings:plan.houses.map(({id,side,x,z,rotation,config})=>({id,side,transform:{x,y:0,z,rotation},house:{schema:'keynlock.house',version:1,params:config}})),
  };
}
