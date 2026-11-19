import { ENTRANCE_DOOR_TEXTURE_URL } from './entrance-door-texture.js';
import { WINDOW_CENTERS, PILASTER_CENTERS, PERIMETER_BAND_Y, vaultHeight,
  WINDOW_SILL_Y, WINDOW_SPRING_Y, WINDOW_SCALE, WINDOW_VERTICAL_SCALE, windowY,
  HALL_HEIGHT_SCALE, WINDOW_OPENING_RADIUS } from './hall-architecture.js?v=26';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Static hall, weather, walls and entrance painting for the 2D renderer.
export function createFallbackArchitecture({ ctx, camera, surfaces, project, path3, segment }) {
  let width = 0, height = 0, frameTime = 0, visualSettings = null;
  const entrancePainting = new Image();
  entrancePainting.src = ENTRANCE_DOOR_TEXTURE_URL;
  function background() {
    const horizon = height * (.48 + camera.rotation.x * .65);
    const wall = ctx.createLinearGradient(0, 0, 0, height);
    const toon = visualSettings.toonEnabled ? visualSettings.toonLight * visualSettings.cartoonMaterial / 10000 : 0;
    wall.addColorStop(0, '#344c47');
    wall.addColorStop(.45 - toon * .10, '#566e60');
    wall.addColorStop(.45 + toon * .10, toon > .1 ? '#748873' : '#66796a');
    wall.addColorStop(1, '#43554c');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);
    const floor = ctx.createLinearGradient(0, horizon, 0, height);
    floor.addColorStop(0, '#776c60');
    floor.addColorStop(1, '#987361');
    ctx.fillStyle = floor;
    ctx.fillRect(0, Math.max(0, horizon), width, height);
    const ceiling = ctx.createLinearGradient(0, 0, 0, Math.max(10, horizon));
    ceiling.addColorStop(0, 'rgba(24,42,39,.64)');
    ceiling.addColorStop(1, 'rgba(59,77,65,0)');
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, width, Math.max(10, horizon));
  }

  function drawWindowSnow(x, z) {
    if (!visualSettings.wetSnowEnabled || visualSettings.snowIntensity === 0) return;
    const amount = visualSettings.snowIntensity / 100;
    const wind = visualSettings.snowWind / 100;
    const visible = Math.round(4 + amount * 29);
    const seconds = frameTime / 1000;
    ctx.save();
    for (let index = 0; index < visible; index++) {
      const seed = index * 17.13 + z * 1.71 + x * 2.7;
      const random = n => (Math.sin(n * 78.233) * 43758.5453 + 1) % 1;
      const u = ((random(seed) + seconds * wind * .034 * (1 + index % 3)) % 1 + 1) % 1;
      const v = ((random(seed + 3.5) - seconds * (.082 + index % 7 * .014)) % 1 + 1) % 1;
      const position = project(x, windowY(6.31 + v * 2.79), z + (-.93 + u * 1.86) * WINDOW_SCALE);
      if (!position) continue;
      const size = clamp((index % 5 === 0 ? 12 : 8) / position.depth, .75, 2.8);
      ctx.fillStyle = `rgba(228,242,238,${(.34 + amount * .48).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(position.x, position.y, size, 0, Math.PI * 2);
      ctx.fill();
      if (index % 5 === 0) {
        ctx.strokeStyle = `rgba(192,217,216,${(amount * .42).toFixed(2)})`;
        ctx.lineWidth = .8;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - size);
        ctx.lineTo(position.x - wind * 2, position.y + size * 3);
        ctx.stroke();
      }
    }
    // Condensed meltwater drifts down the glass more slowly than the flakes.
    for (let index = 0; index < 4; index++) {
      const offset = (((index * .273 + .12) % 1) * 1.72 - .86) * WINDOW_SCALE;
      const lead = ((seconds * (.019 + index * .006) + index * .21) % 1 + 1) % 1;
      const from = project(x, windowY(8.86 - lead * 1.8), z + offset);
      const to = project(x, windowY(8.63 - lead * 1.8), z + offset - wind * .04 * WINDOW_SCALE);
      if (!from || !to) continue;
      ctx.strokeStyle = `rgba(219,244,241,${(amount * .27).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEntranceDoor() {
    if (!entrancePainting.naturalWidth) return;
    // Approximate perspective in the fallback renderer with an affine image
    // transform. The actual WebGL entrance uses the same image on a flat plane.
    const topLeft = project(2.2, 6.67, 22.665);
    const topRight = project(-2.2, 6.67, 22.665);
    const bottomLeft = project(2.2, .23, 22.665);
    if (!topLeft || !topRight || !bottomLeft) return;
    const w = entrancePainting.naturalWidth;
    const h = entrancePainting.naturalHeight;
    ctx.save();
    ctx.transform((topRight.x - topLeft.x) / w, (topRight.y - topLeft.y) / w,
      (bottomLeft.x - topLeft.x) / h, (bottomLeft.y - topLeft.y) / h,
      topLeft.x, topLeft.y);
    ctx.drawImage(entrancePainting, 0, 0);
    ctx.restore();
  }

  function architecture() {
    // The room is drawn as a set of projected linework and painted wall planes.
    path3([[-11.8, 0, -23], [11.8, 0, -23], [11.8, 0, 23], [-11.8, 0, 23]], surfaces.floor);
    const wallTop = 11 * HALL_HEIGHT_SCALE;
    path3([[-11.85, 0, -23], [-11.85, wallTop, -23],
      [-11.85, wallTop, 23], [-11.85, 0, 23]], surfaces.plaster, '#a0906e');
    path3([[11.85, 0, -23], [11.85, wallTop, -23],
      [11.85, wallTop, 23], [11.85, 0, 23]], surfaces.plaster, '#a0906e');
    path3([[-11.8, 0, -23], [11.8, 0, -23],
      [11.8, wallTop, -23], [-11.8, wallTop, -23]], surfaces.plaster, '#b7a078');
    path3([[-11.8, vaultHeight(-11.8), -23], [11.8, vaultHeight(11.8), -23],
      [11.8, vaultHeight(11.8), 23], [-11.8, vaultHeight(-11.8), 23]], surfaces.ceiling);

    // Red-brown sorting rug with hand-painted brass border.
    path3([[-8, .017, -18.6], [8, .017, -18.6], [8, .017, 18.2], [-8, .017, 18.2]], surfaces.carpet, '#ddbd81', 3);
    if (visualSettings.windowDaylight > 0) {
      ctx.save();
      ctx.globalAlpha = visualSettings.windowDaylight / 100 * .17;
      for (const z of WINDOW_CENTERS) {
        path3([[-8.4, .021, z - 1.15], [-2.9, .021, z + .45],
          [-2.9, .021, z + 2.35], [-8.4, .021, z + .75]], '#f9dc9c');
      }
      ctx.restore();
    }
    for (let x = -10; x <= 10; x += 2) {
      for (let z = -22; z < 23; z += 2) segment([x, .02, z], [x, .02, z + 2], 'rgba(184,151,104,.16)', 1);
    }
    for (let z = -22; z <= 22; z += 2) {
      for (let x = -10; x < 11; x += 2) segment([x, .02, z], [x + 2, .02, z], 'rgba(184,151,104,.12)', 1);
    }

    // Pilasters and transoms that repeat in perspective.
    for (const x of [-11.78, 11.78]) {
      for (const z of PILASTER_CENTERS) {
        segment([x, .2, z], [x, 10.7 * HALL_HEIGHT_SCALE, z], '#9bae9d', 10);
        segment([x, PERIMETER_BAND_Y, z - .32], [x, PERIMETER_BAND_Y, z + .32], '#76573f', 7);
        segment([x, 10.66 * HALL_HEIGHT_SCALE, z - .34],
          [x, 10.66 * HALL_HEIGHT_SCALE, z + .34], '#76573f', 7);
      }
      for (const z of WINDOW_CENTERS) {
        const radius = WINDOW_OPENING_RADIUS * WINDOW_SCALE;
        const pane = [[x, windowY(WINDOW_SILL_Y), z - radius],
          [x, windowY(WINDOW_SILL_Y), z + radius],
          [x, windowY(WINDOW_SPRING_Y), z + radius]];
        for (let i = 0; i <= 16; i++) {
          const angle = Math.PI * i / 16;
          pane.push([x, windowY(WINDOW_SPRING_Y) +
            WINDOW_OPENING_RADIUS * WINDOW_VERTICAL_SCALE * Math.sin(angle),
            z + radius * Math.cos(angle)]);
        }
        path3(pane, 'rgba(177,219,204,.46)', '#e0c58e', 3);
        drawWindowSnow(x, z);
        segment([x, windowY(WINDOW_SILL_Y), z], [x, windowY(WINDOW_SPRING_Y + WINDOW_OPENING_RADIUS), z], '#76573f', 3);
        for (const y of [7.43, 8.64])
          segment([x, windowY(y), z - radius], [x, windowY(y), z + radius], '#76573f', 3);
      }
    }
    for (const z of PILASTER_CENTERS) {
      for (let i = 0; i < 24; i++) {
        const x1 = -11.8 + i * 23.6 / 24;
        const x2 = -11.8 + (i + 1) * 23.6 / 24;
        segment([x1, vaultHeight(x1) - .04, z], [x2, vaultHeight(x2) - .04, z], '#8d6e58', 5);
      }
    }
    segment([-11.8, PERIMETER_BAND_Y, -23], [-11.8, PERIMETER_BAND_Y, 23], '#76573f', 4);
    segment([11.8, PERIMETER_BAND_Y, -23], [11.8, PERIMETER_BAND_Y, 23], '#76573f', 4);
    for (const z of [-23, 23]) segment([-11.8, PERIMETER_BAND_Y, z],
      [11.8, PERIMETER_BAND_Y, z], '#76573f', 4);
    // A sealed door ahead, visible behind the scattered keys.
    path3([[-1.25, .125, -22.7], [1.25, .125, -22.7], [1.25, 3.55, -22.7], [-1.25, 3.55, -22.7]], '#221f1e', '#c4a576', 5);
    for (const x of [-1.55, -.8, 0, .8, 1.55]) segment([x * .5, .15, -22.6], [x * .5, 3.45, -22.6], '#70563c', 3);
    const emblem = project(0, 2.60, -22.5);
    if (emblem) {
      const radius = clamp(25 / emblem.depth * 3, 2.5, 12);
      ctx.fillStyle = '#c9a46c';
      ctx.beginPath();
      ctx.arc(emblem.x, emblem.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#30251e';
      ctx.beginPath();
      ctx.arc(emblem.x, emblem.y - radius * .23, radius * .28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(emblem.x - radius * .18, emblem.y, radius * .36, radius * .57);
    }
    drawEntranceDoor();
    for (const z of [-13, 0, 13]) {
      segment([0, vaultHeight(0) - .1, z], [0, 8, z], '#ac9367', 3);
      const bulb = project(0, 7.92, z);
      if (!bulb) continue;
      const radius = clamp(26 / bulb.depth * 3, 3, 18);
      const glow = ctx.createRadialGradient(bulb.x, bulb.y, 1, bulb.x, bulb.y, radius * 2.8);
      glow.addColorStop(0, 'rgba(255,219,147,.9)');
      glow.addColorStop(.25, 'rgba(255,198,111,.38)');
      glow.addColorStop(1, 'rgba(255,193,108,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y, radius * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    background, architecture,
    setFrame(frame) {
      width = frame.width;
      height = frame.height;
      frameTime = frame.frameTime;
      visualSettings = frame.visualSettings;
    },
  };
}
