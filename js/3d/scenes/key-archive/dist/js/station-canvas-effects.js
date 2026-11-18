import { bathVisualState, meltVisualIntensity } from './station-visual-state.js';

// Matching small gouache strokes for the emergency Canvas renderer.
export function drawBathActivity(ctx, center, radius, kind, keys, now, wallTime) {
  const state = bathVisualState(keys, kind, wallTime);
  if (!state.active) return;
  const pigment = kind === 'mud' ? '#ae9872' : '#c99162';
  const highlight = kind === 'mud' ? '#d8e9cd' : '#f8d4ac';
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radius * .94, radius * .39, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let index = 0; index < 7; index++) {
    const drift = now * .00065 + index * 2.39;
    ctx.globalAlpha = (.18 + .24 * state.pigment) * (1 - index * .055);
    ctx.fillStyle = pigment;
    ctx.beginPath();
    ctx.ellipse(center.x + Math.sin(drift) * radius * .65,
      center.y + Math.cos(drift * .77) * radius * .20,
      radius * (.16 + (index % 3) * .045), radius * .055,
      Math.sin(drift) * .4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let index = 0; index < 3; index++) {
    const phase = (now * .00033 + index / 3) % 1;
    ctx.globalAlpha = (1 - phase) * .47;
    ctx.strokeStyle = highlight;
    ctx.lineWidth = Math.max(1, radius * .024);
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radius * (.15 + phase * .70),
      radius * (.07 + phase * .27), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = highlight;
  for (let index = 0; index < 7; index++) {
    const phase = (now * (.0004 + (index % 3) * .0001) + index * .237) % 1;
    const x = center.x + Math.sin(index * 3.5 + now * .0004) * radius * .73;
    const y = center.y - radius * (.06 + phase * .8);
    const bubble = Math.max(1, radius * (.024 + (index % 3) * .011));
    ctx.globalAlpha = Math.sin(phase * Math.PI) * .72;
    ctx.beginPath(); ctx.arc(x, y, bubble, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // The rim itself shows how much of the current soak has elapsed.
  ctx.save();
  ctx.strokeStyle = highlight;
  ctx.lineWidth = Math.max(2, radius * .065);
  ctx.globalAlpha = .82;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radius * 1.03, radius * .45,
    0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.progress);
  ctx.stroke();
  ctx.restore();
}

export function drawBathKeys(ctx, center, radius, kind, keys, wallTime) {
  ctx.save();
  keys.slice(0, 4).forEach((key, index) => {
    const ready = wallTime >= key.bathUntil;
    const xx = center.x + (index % 2 ? .37 : -.37) * radius;
    const yy = center.y + (index < 2 ? -.14 : .14) * radius;
    const size = Math.max(2.5, radius * .105);
    ctx.strokeStyle = ready ? '#f1d39b' : kind === 'mud' ? '#78694d' : '#a65b39';
    ctx.lineWidth = Math.max(1.1, radius * .045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(xx - size * .22, yy - size * .20, size * .33, 0, Math.PI * 2);
    ctx.moveTo(xx, yy); ctx.lineTo(xx + size * .72, yy + size * .56);
    ctx.lineTo(xx + size * .52, yy + size * .84);
    ctx.moveTo(xx + size * .48, yy + size * .38);
    ctx.lineTo(xx + size * .32, yy + size * .60);
    ctx.stroke();
  });
  ctx.restore();
}

export function drawForgeActivity(ctx, center, radius, now, impactAt) {
  const intensity = meltVisualIntensity(now, impactAt);
  if (intensity <= .001) return;
  ctx.save();
  const glow = ctx.createRadialGradient(center.x, center.y, 0,
    center.x, center.y, radius * 1.8);
  glow.addColorStop(0, `rgba(255,225,145,${(.58 * intensity).toFixed(3)})`);
  glow.addColorStop(.38, `rgba(231,124,61,${(.38 * intensity).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(205,106,55,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radius * 1.8, radius * .92, 0, 0, Math.PI * 2);
  ctx.fill();
  const age = Math.max(0, now - impactAt) / 1500;
  for (let index = 0; index < 12; index++) {
    const flight = (age * (1.05 + index * .11) + index * .119) % 1;
    ctx.globalAlpha = intensity * (1 - flight) * .86;
    ctx.fillStyle = index % 3 ? '#f1aa60' : '#ffdf9a';
    const x = center.x + Math.sin(index * 2.45 + now * .001) * radius * (.25 + flight * .48);
    const y = center.y - flight * radius * 1.9;
    const size = Math.max(1.2, radius * (.035 + (index % 3) * .017));
    ctx.beginPath(); ctx.ellipse(x, y, size, size * 1.35, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
