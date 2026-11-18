// Three evenly spaced work islands keep every floor key close to a cleaning
// or recycling point.  Their footprint also reserves a clear patch of floor.
export const STATIONS = Object.freeze([
  { id: 'far', name: 'ДАЛЬНЯЯ', x: 0, z: -12.5 },
  { id: 'center', name: 'ЦЕНТРАЛЬНАЯ', x: 0, z: 0 },
  { id: 'near', name: 'БЛИЖНЯЯ', x: 0, z: 12.5 },
]);

export const BATH_CAPACITY = 4;
export const SOAK_SECONDS = Object.freeze({ mud: 5, rust: 7 });
export const FIXTURE_OFFSETS = Object.freeze({ mud: -1.48, forge: 0, rust: 1.48 });

export function bathId(stationId, kind) {
  return `${stationId}-${kind}`;
}

export function validBathId(id, kind = null) {
  return STATIONS.some(station => (kind ? [kind] : ['mud', 'rust'])
    .some(item => bathId(station.id, item) === id));
}

export function inStationFootprint(x, z, padding = 0) {
  return STATIONS.some(station => Math.abs(x - station.x) < 2.44 + padding &&
    Math.abs(z - station.z) < 1.13 + padding);
}
