/**
 * Semi-transparent, seeded canvas textures for aged paintings.
 * The layers are independent so restoration tools can remove them separately.
 */
export function paintAgingTextures({ width, height, random, dust, dirt, cracks, loss, uvSource }) {
  const w = width;
  const h = height;
  const rand = (min, max) => min + (max - min) * random();

  function haze(context, x, y, radius, color, stretch = 1) {
    context.save();
    context.translate(x, y);
    context.rotate(rand(-Math.PI, Math.PI));
    context.scale(1, stretch);
    const gradient = context.createRadialGradient(0, 0, radius * .08, 0, 0, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(.48, color.replace(/,\s*([\d.]+)\)$/, (_, a) => `,${Number(a) * .56})`));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // Dust: a thin translucent veil, powdery circular grains and soft pale clouds.
  dust.fillStyle = 'rgba(181,159,117,.065)';
  dust.fillRect(0, 0, w, h);
  for (let i = 0; i < 110; i++) {
    haze(dust, rand(-15, w + 15), rand(-15, h + 15), rand(16, 92),
      i % 3 ? 'rgba(171,145,104,.075)' : 'rgba(221,199,158,.13)', rand(.3, 1.7));
  }
  for (let i = 0; i < 1400; i++) {
    const r = rand(.18, 1.25);
    dust.fillStyle = i % 5 ? 'rgba(96,80,61,.11)' : 'rgba(208,188,151,.09)';
    dust.beginPath();
    dust.arc(rand(0, w), rand(0, h), r, 0, Math.PI * 2);
    dust.fill();
  }

  // Grime: uneven warm stains, with stronger buildup near edges and corners.
  const edgeTone = ['rgba(66,51,38,.26)', 'rgba(111,76,49,.23)', 'rgba(145,105,62,.18)'];
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const radius = Math.min(w, h) * rand(.35, .57);
    const gradient = dirt.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(50,36,25,${rand(.12, .21)})`);
    gradient.addColorStop(.56, 'rgba(95,67,42,.06)');
    gradient.addColorStop(1, 'rgba(95,67,42,0)');
    dirt.fillStyle = gradient;
    dirt.fillRect(Math.max(0, x - radius), Math.max(0, y - radius), radius, radius);
  }
  for (let i = 0; i < 72; i++) {
    let x = rand(0, w);
    let y = rand(0, h);
    if (random() < .57) {
      if (random() < .5) x = random() < .5 ? rand(-25, w * .13) : rand(w * .87, w + 25);
      else y = random() < .5 ? rand(-25, h * .13) : rand(h * .87, h + 25);
    }
    const radius = rand(13, 76);
    haze(dirt, x, y, radius, edgeTone[i % edgeTone.length], rand(.42, 1.8));
    if (i % 3 === 0) haze(dirt, x + rand(-10, 10), y + rand(-10, 10), radius * .46,
      'rgba(61,45,29,.22)', rand(.45, 1.5));
    for (let j = 0; j < 8; j++) {
      const sx = x + rand(-radius * .7, radius * .7);
      const sy = y + rand(-radius * .7, radius * .7);
      dirt.fillStyle = `rgba(60,44,30,${rand(.08, .23)})`;
      dirt.beginPath();
      dirt.ellipse(sx, sy, rand(.35, 2.4), rand(.25, 1.5), rand(0, 6.28), 0, Math.PI * 2);
      dirt.fill();
    }
  }
  // A few barely perceptible old handling marks, behind the dust layer.
  dirt.lineCap = 'round';
  for (let i = 0; i < 15; i++) {
    const x = rand(0, w);
    const y = rand(0, h);
    dirt.beginPath();
    dirt.moveTo(x, y);
    dirt.bezierCurveTo(x + rand(-12, 12), y + rand(8, 20),
      x + rand(-12, 12), y + rand(18, 35), x + rand(-8, 8), y + rand(30, 58));
    dirt.strokeStyle = `rgba(76,54,33,${rand(.045, .12)})`;
    dirt.lineWidth = rand(1, 3.2);
    dirt.stroke();
  }

  // Several distinct water-tide marks: cloudy halos with irregular, broken rims.
  for (let stain = 0; stain < 3 + Math.floor(random() * 3); stain++) {
    const cx = rand(w * .08, w * .92);
    const cy = rand(h * .06, h * .94);
    const radius = rand(35, Math.min(w, h) * .26);
    haze(dirt, cx, cy, radius * 1.35, 'rgba(106,82,56,.14)', rand(.45, 1.45));
    dirt.save();
    dirt.translate(cx, cy);
    dirt.rotate(rand(-Math.PI, Math.PI));
    dirt.scale(1, rand(.5, 1.2));
    for (let rim = 0; rim < 2; rim++) {
      dirt.beginPath();
      const wave = rand(0, Math.PI * 2);
      for (let point = 0; point <= 36; point++) {
        const angle = point / 36 * Math.PI * 2;
        const radial = radius * (rim ? .83 : 1) *
          (1 + Math.sin(angle * 3 + wave) * .09 + Math.sin(angle * 7 - wave) * .045);
        const x = Math.cos(angle) * radial;
        const y = Math.sin(angle) * radial;
        if (!point) dirt.moveTo(x, y);
        else dirt.lineTo(x, y);
      }
      dirt.strokeStyle = `rgba(88,60,38,${rim ? .065 : .14})`;
      dirt.lineWidth = rand(.7, 1.8);
      dirt.stroke();
    }
    dirt.restore();
  }

  // Tiny missing-paint chips expose warm gesso. A dedicated fine retouch
  // brush removes only this mask, revealing the intact source pigment below.
  const clusters = 11 + Math.floor(random() * 9);
  for (let cluster = 0; cluster < clusters; cluster++) {
    let cx = rand(w * .035, w * .965);
    let cy = rand(h * .035, h * .965);
    if (random() < .56) {
      if (random() < .5) cx = random() < .5 ? rand(0, w * .14) : rand(w * .86, w);
      else cy = random() < .5 ? rand(0, h * .14) : rand(h * .86, h);
    }
    const chips = 3 + Math.floor(random() * 5);
    for (let chip = 0; chip < chips; chip++) {
      const x = cx + rand(-11, 11);
      const y = cy + rand(-11, 11);
      const r = rand(.8, 3.4);
      const corners = 5 + Math.floor(random() * 3);
      loss.beginPath();
      for (let corner = 0; corner < corners; corner++) {
        const angle = corner * Math.PI * 2 / corners;
        const rough = rand(.65, 1.3);
        const px = x + Math.cos(angle) * r * rough;
        const py = y + Math.sin(angle) * r * rough * rand(.6, 1.1);
        if (!corner) loss.moveTo(px, py);
        else loss.lineTo(px, py);
      }
      loss.closePath();
      loss.fillStyle = `rgba(214,197,163,${rand(.42, .68)})`;
      loss.fill();
      loss.lineWidth = .5;
      loss.strokeStyle = `rgba(78,58,41,${rand(.08, .16)})`;
      loss.stroke();
    }
  }

  // Craquelure: localized, irregular networks of hairline cracks in old varnish.
  // UV sees the same lines; reagent removes the affected varnish, including them.
  cracks.lineCap = 'round';
  cracks.lineJoin = 'round';
  uvSource.lineCap = 'round';
  uvSource.lineJoin = 'round';
  const crackPatches = 9 + Math.floor(random() * 8);
  for (let patch = 0; patch < crackPatches; patch++) {
    const cx = rand(w * .06, w * .94);
    const cy = rand(h * .06, h * .94);
    const radius = rand(52, 132);
    const spacing = rand(13, 26);
    const size = Math.ceil(radius / spacing);
    const angle = rand(-Math.PI, Math.PI);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nodes = [];
    for (let iy = -size; iy <= size; iy++) {
      const row = [];
      for (let ix = -size; ix <= size; ix++) {
        const localX = ix * spacing + rand(-spacing * .31, spacing * .31);
        const localY = iy * spacing + rand(-spacing * .31, spacing * .31);
        row.push({ x: cx + localX * cos - localY * sin,
          y: cy + localX * sin + localY * cos });
      }
      nodes.push(row);
    }
    function trace(a, b) {
      if (random() < .19) return; // breaks and worn areas, rather than a perfect grid
      const middleX = (a.x + b.x) * .5;
      const middleY = (a.y + b.y) * .5;
      const fade = Math.max(0, 1 - Math.hypot(middleX - cx, middleY - cy) / radius);
      if (fade <= 0 || middleX < -3 || middleX > w + 3 || middleY < -3 || middleY > h + 3) return;
      const alpha = (.06 + .33 * fade * fade) * rand(.72, 1.05);
      const kinkX = middleX + rand(-spacing * .15, spacing * .15);
      const kinkY = middleY + rand(-spacing * .15, spacing * .15);

      cracks.beginPath();
      cracks.moveTo(a.x, a.y);
      cracks.quadraticCurveTo(kinkX, kinkY, b.x, b.y);
      cracks.strokeStyle = `rgba(47,37,31,${alpha})`;
      cracks.lineWidth = rand(.45, .95);
      cracks.stroke();

      // Very faint warm ridge alongside the incision, as in brittle varnish.
      if (random() < .43) {
        cracks.beginPath();
        cracks.moveTo(a.x + .85, a.y + .7);
        cracks.quadraticCurveTo(kinkX + .85, kinkY + .7, b.x + .85, b.y + .7);
        cracks.strokeStyle = `rgba(236,212,166,${alpha * .38})`;
        cracks.lineWidth = .65;
        cracks.stroke();
      }

      uvSource.beginPath();
      uvSource.moveTo(a.x, a.y);
      uvSource.quadraticCurveTo(kinkX, kinkY, b.x, b.y);
      uvSource.strokeStyle = `rgba(100,220,240,${Math.min(.75, alpha * 1.7)})`;
      uvSource.lineWidth = 1.8;
      uvSource.stroke();
    }
    for (let iy = 0; iy < nodes.length; iy++) {
      for (let ix = 0; ix < nodes[iy].length; ix++) {
        const a = nodes[iy][ix];
        if (ix + 1 < nodes[iy].length) trace(a, nodes[iy][ix + 1]);
        if (iy + 1 < nodes.length) trace(a, nodes[iy + 1][ix]);
      }
    }
  }
}
