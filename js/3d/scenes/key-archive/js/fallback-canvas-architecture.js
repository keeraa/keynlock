import { createCanvasWindowSky } from './archive-sky.js';
import { windowLightPalette } from './window-light-palette.js';
import { createWindowBirdFlight, BIRD_WIDTH, BIRD_HEIGHT } from './archive-window-bird.js?v=alchemy-candles';
import { WINDOW_WASHES, WINDOW_BEAM_SLOPE, WINDOW_BEAM_HALF_WIDTH } from './window-beam-light.js?v=alchemy-candles';
import { ENTRANCE_DOOR_TEXTURE_URL } from './entrance-door-texture.js';
import { ENTRANCE_CANDLE, sampleCandleFlicker } from './archive-candles.js?v=key-catalog';
import { ARCHIVE_DESK, ARCHIVE_LEDGER, ARCHIVE_LEDGER_URL } from './archive-ledger.js?v=key-catalog';
import { WINDOW_CENTERS, PILASTER_CENTERS, PERIMETER_BAND_Y, vaultHeight,
  WINDOW_SILL_Y, WINDOW_SPRING_Y, WINDOW_SCALE, WINDOW_VERTICAL_SCALE, windowY,
  HALL_HEIGHT_SCALE, WINDOW_OPENING_RADIUS } from './hall-architecture.js?v=alchemy-candles';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Use the same projected arch for the wall and the ceiling at each end.
const vaultEdge = z => Array.from({ length: 17 }, (_, index) => {
  const x = 11.85 * (index / 8 - 1);
  return [x, vaultHeight(x), z];
});
const farVaultEdge = vaultEdge(-23);
const nearVaultEdge = vaultEdge(23).reverse();

// Static hall, weather, walls and entrance painting for the 2D renderer.
export function createFallbackArchitecture({ ctx, camera, surfaces, project, path3, segment, drawFurnitureShadow, furnitureShadows }) {
  let width = 0, height = 0, frameTime = 0, visualSettings = null;
  let ledgerVisible = true, ledgerHovered = false;
  const bird = createWindowBirdFlight();
  const paintSky = createCanvasWindowSky(ctx, camera, project, path3);
  const entrancePainting = new Image();
  entrancePainting.src = ENTRANCE_DOOR_TEXTURE_URL;
  const ledgerPainting = new Image();
  ledgerPainting.src = ARCHIVE_LEDGER_URL;
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

  function drawBirdInPane(x, z, pane) {
    const pose = bird.pose;
    if (x > 0 || pose.z === 0 || Math.abs(pose.y - z) > WINDOW_OPENING_RADIUS * WINDOW_SCALE + BIRD_WIDTH / 2) return;
    const left = pose.y - pose.w * BIRD_WIDTH / 2;
    const right = pose.y + pose.w * BIRD_WIDTH / 2;
    const top = pose.x + BIRD_HEIGHT / 2;
    const topLeft = project(x, top, left);
    const topRight = project(x, top, right);
    const bottomLeft = project(x, top - BIRD_HEIGHT, left);
    if (!topLeft || !topRight || !bottomLeft || !path3(pane, null)) return;
    ctx.save();
    ctx.clip();
    ctx.transform((topRight.x - topLeft.x) / bird.canvas.width, (topRight.y - topLeft.y) / bird.canvas.width,
      (bottomLeft.x - topLeft.x) / bird.canvas.height, (bottomLeft.y - topLeft.y) / bird.canvas.height,
      topLeft.x, topLeft.y);
    ctx.drawImage(bird.canvas, 0, 0);
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

  function drawArchiveDesk() {
    const { x: deskX, y: deskY, z: deskZ, width, depth } = ARCHIVE_DESK;
    const left = deskX - width / 2, right = deskX + width / 2;
    const front = deskZ - depth / 2, back = deskZ + depth / 2;
    drawFurnitureShadow(furnitureShadows.deskFloor, deskX, 0, deskZ);
    for (const x of [deskX - .7, deskX + .7]) for (const z of [deskZ - .9, deskZ + .9]) {
      segment([x, 0, z], [x, .89, z], '#705039', 5);
    }
    const tabletop = [[left, deskY, front], [right, deskY, front],
      [right, deskY, back], [left, deskY, back]];
    if (!path3(tabletop, surfaces.wood, '#60422d', 3)) return;
    if (ledgerVisible) drawLedger();
    drawDeskCandleLight(tabletop);
  }

  function drawLedger() {
    const { x, y, z, yaw, width: bookWidth, depth: bookDepth } = ARCHIVE_LEDGER;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const corner = (u, v) => project(x + c * u + s * v, y + .047, z - s * u + c * v);
    const a = corner(-bookWidth / 2, -bookDepth / 2);
    const b = corner(bookWidth / 2, -bookDepth / 2);
    const d = corner(-bookWidth / 2, bookDepth / 2);
    if (!a || !b || !d) return;
    ctx.save();
    ctx.transform(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y, a.x, a.y);
    if (ledgerPainting.naturalWidth) ctx.drawImage(ledgerPainting, 0, 0, 1, 1);
    else {
      ctx.fillStyle = '#ccb28b';
      ctx.fillRect(0, 0, 1, 1);
    }
    if (ledgerHovered) {
      ctx.lineWidth = .025;
      ctx.strokeStyle = '#fff0bb';
      ctx.strokeRect(0, 0, 1, 1);
    }
    ctx.restore();
  }

  function drawDeskCandleLight(tabletop) {
    const { x, y, z } = ENTRANCE_CANDLE;
    const center = project(x + .045, y, z);
    const along = project(x + 1.045, y, z);
    const across = project(x + .045, y, z + 1);
    if (!center || !along || !across || !path3(tabletop, null)) return;
    ctx.save();
    ctx.clip();
    ctx.transform(along.x - center.x, along.y - center.y,
      across.x - center.x, across.y - center.y, center.x, center.y);
    const strength = 1 + .12 * sampleCandleFlicker(frameTime, x, z);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, `rgba(255,164,83,${.34 * strength})`);
    glow.addColorStop(.56, `rgba(255,164,83,${.16 * strength})`);
    glow.addColorStop(1, 'rgba(255,164,83,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function drawLightWash({ x, z, width }, rgb, opacity) {
    if (opacity <= 0) return;
    const center = project(x, .021, z);
    const length = project(x + width / 2, .021, z - width / 2 * WINDOW_BEAM_SLOPE.z);
    const across = project(x, .021, z + WINDOW_BEAM_HALF_WIDTH * 1.10);
    if (!center || !length || !across) return;
    ctx.save();
    ctx.transform(length.x - center.x, length.y - center.y,
      across.x - center.x, across.y - center.y, center.x, center.y);
    const gradient = ctx.createRadialGradient(0, 0, .22, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${rgb},${opacity})`);
    gradient.addColorStop(.60, `rgba(${rgb},${opacity * .72})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function architecture() {
    const palette = windowLightPalette(visualSettings.nightLighting);
    // The room is drawn as a set of projected linework and painted wall planes.
    path3([[-11.8, 0, -23], [11.8, 0, -23], [11.8, 0, 23], [-11.8, 0, 23]], surfaces.floor);
    const wallTop = 11 * HALL_HEIGHT_SCALE;
    path3([[-11.85, 0, -23], [-11.85, wallTop, -23],
      [-11.85, wallTop, 23], [-11.85, 0, 23]], surfaces.plaster, '#a0906e');
    path3([[11.85, 0, -23], [11.85, wallTop, -23],
      [11.85, wallTop, 23], [11.85, 0, 23]], surfaces.plaster, '#a0906e');
    path3([[11.85, 0, -23], [-11.85, 0, -23], ...farVaultEdge], surfaces.plaster, '#b7a078');
    path3([...farVaultEdge, ...nearVaultEdge], surfaces.ceiling);

    // Plain claret gouache rug, without an ornamental border.
    path3([[-8, .017, -18.6], [8, .017, -18.6], [8, .017, 18.2], [-8, .017, 18.2]], surfaces.carpet, null, 0);
    for (const wash of WINDOW_WASHES) drawLightWash(wash, palette.canvasWash, visualSettings.windowDaylight / 100 * .14);
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
        paintSky(x, z, pane, frameTime, visualSettings.nightLighting);
        path3(pane, null, '#e0c58e', 3);
        drawBirdInPane(x, z, pane);
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
    drawArchiveDesk();
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
      bird.update(frame.frameTime, frame.playing);
      visualSettings = frame.visualSettings;
      ledgerVisible = frame.ledgerVisible;
      ledgerHovered = frame.ledgerHovered;
    },
  };
}
