// @ts-check
// A lathed liquid surface whose lower portion fits the vessel's rounded glass.
// Source tubes use a hemispherical bottom. The bottle liquid is sampled from
// the same lathe outline as its glass, with clearance for wall thickness.
const clamp01 = value => Math.max(0, Math.min(1, value));

export const BOTTLE_GLASS_PROFILE = Object.freeze([
  [0, .07], [.18, .10], [.35, .18], [.41, .35], [.41, .68],
  [.38, .80], [.18, .92], [.15, 1.13], [.20, 1.16], [.20, 1.21],
  [.135, 1.21], [.135, 1.12]
]);

// Each internal radius is slightly smaller than the interpolated glass wall.
const BOTTLE_INNER_WALL = [
  [.12, .194], [.18, .304], [.35, .355], [.68, .355],
  [.80, .333], [.92, .152], [1.12, .122], [1.21, .122]
];

function interpolateRadius(profile, y) {
  if (y <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    if (y <= profile[i][0]) {
      const [fromY, fromRadius] = profile[i - 1];
      const [toY, toRadius] = profile[i];
      return fromRadius + (toRadius - fromRadius) * ((y - fromY) / (toY - fromY));
    }
  }
  return profile[profile.length - 1][1];
}

export function liquidRadiusAt(kind, y, radius, bottom) {
  if (kind === 'bottle') {
    return interpolateRadius(BOTTLE_INNER_WALL, y) * radius / .355;
  }
  const rounding = kind === 'tube' ? radius : Math.min(.37, radius * .58);
  const t = clamp01((y - bottom) / rounding);
  return radius * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
}

export function liquidRingAt(kind, layer, layers, level, radius, bottom, shift = 0) {
  const u = layer / layers;
  if (kind === 'bottle') {
    const y = bottom + (level - bottom) * u + shift * u * u;
    return { y, radius: liquidRadiusAt(kind, y, radius, bottom) };
  }
  const rounding = kind === 'tube' ? radius : Math.min(.37, radius * .58);
  const curvedHeight = Math.min(rounding, Math.max(.0001, level - bottom));
  let y;
  if (level - bottom <= rounding) {
    const maxTheta = Math.acos(1 - curvedHeight / rounding);
    y = bottom + rounding * (1 - Math.cos(maxTheta * u));
  } else if (u <= .45) {
    const theta = Math.PI / 2 * (u / .45);
    y = bottom + rounding * (1 - Math.cos(theta));
  } else {
    y = bottom + rounding + (level - bottom - rounding) * (u - .45) / .55;
  }
  y += shift * u * u;
  return { y, radius: liquidRadiusAt(kind, y, radius, bottom) };
}
