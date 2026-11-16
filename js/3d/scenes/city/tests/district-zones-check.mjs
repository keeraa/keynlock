import assert from 'node:assert/strict';
import { DISTRICTS } from '../js/world-data.js';
import { DISTRICT_ZONES, MAIN_RIVER, WATERWAYS, ZONING_PLAN, districtZoneAt, pointInPolygon, polygonPath } from '../js/district-zoning.js';

const ids = new Set(DISTRICTS.map(district => district.id));
assert.equal(ZONING_PLAN.version, 1);
assert.equal(ZONING_PLAN.width, 1548);
assert.equal(ZONING_PLAN.height, 1148);
assert.equal(DISTRICT_ZONES.length, 7);
assert.equal(new Set(DISTRICT_ZONES.map(zone => zone.id)).size, 7);
assert.deepEqual(new Set(DISTRICT_ZONES.map(zone => zone.id)), ids);
assert.ok(MAIN_RIVER.length > 20);
assert.ok(polygonPath(MAIN_RIVER).startsWith('M'));
assert.ok(polygonPath(MAIN_RIVER).endsWith(' Z'));
assert.equal(WATERWAYS.length, 2);

for (const zone of DISTRICT_ZONES) {
  assert.ok(zone.polygons.length > 0, `Missing polygon for ${zone.id}`);
  assert.ok(zone.polygons.every(polygon => polygon.length >= 3), `Degenerate polygon for ${zone.id}`);
  for (const polygon of zone.polygons) for (const point of polygon) {
    assert.ok(point.every(Number.isFinite), `Non-numeric point for ${zone.id}`);
  }
  assert.ok(zone.polygons.some(polygon => pointInPolygon(...zone.anchor, polygon)), `Label outside ${zone.id}`);
  assert.equal(districtZoneAt(...zone.anchor), zone.id, `Anchor mapped to another district: ${zone.id}`);
}

for (const [x, y] of [[900, 340], [680, 400], [500, 540], [1400, 265], [145, 280]]) {
  assert.equal(districtZoneAt(x, y), null, `River must remain unassigned: ${x},${y}`);
}
assert.equal(districtZoneAt(-10, 30), null);
assert.equal(districtZoneAt(900, 1200), null);
assert.equal(districtZoneAt(Number.NaN, 4), null);
console.log('District zoning: seven unique regions, valid anchors and excluded river OK');
