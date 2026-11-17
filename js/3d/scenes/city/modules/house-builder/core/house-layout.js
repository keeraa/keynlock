import { normalizeHouseConfig } from './house-config.js';

// Reuse the same facade bays on every floor. The entrance and upper balcony
// replace the central bay instead of squeezing adjacent windows sideways.
export function windowLayout(config) {
  const c = normalizeHouseConfig(config);
  const front = [];
  const sides = [];
  const base = .32;
  const bayCount = c.frontWindows % 2 ? c.frontWindows : c.frontWindows + 1;
  const step = (c.width - 1) / bayCount;
  const half = Math.floor(bayCount / 2);
  const positions = Array.from({length:bayCount},(_,i)=>(i-half)*step);
  // Leave space for the door arch, window casings and optional open shutters.
  const windowWidth = Math.min(1.06,
    c.shutters ? (step-.20)/1.78 : step-.50,
    (step-(c.shutters ? 1.02 : 1.19))/(c.shutters ? .89 : .5));
  const sideStep = c.depth / (c.sideWindows + 1);
  const sideWindowWidth = Math.min(.97,
    c.shutters ? (sideStep-.20)/1.78 : sideStep-.50);

  for (let floor = 0; floor < c.floors; floor++) {
    const y = base + floor * c.floorHeight + 1.36;
    const centralOpening = floor === 0 || (floor === 1 && c.balcony);
    for (let i=0; i<positions.length; i++) {
      if (i === half && (centralOpening || c.frontWindows % 2 === 0)) continue;
      front.push({x:positions[i],y,floor,width:windowWidth});
    }
    for (let index = 0; index < c.sideWindows; index++) {
      const z = -c.depth / 2 + sideStep * (index + 1);
      sides.push({z, y, floor, width: sideWindowWidth});
    }
  }
  return {front, sides, totalWindows: front.length + sides.length * 2};
}
