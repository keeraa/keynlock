import { bathVisualState, meltVisualIntensity, bathKeyProgress, waterDip, BATH_LIFT_MS } from './station-visual-state.js';

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

}

export function drawBathKeys(ctx, center, radius, kind, keys, wallTime, lift, now) {
  ctx.save();
  function paint(x, y, residue, drip) {
    const size = Math.max(3, radius * .15);
    ctx.strokeStyle = '#e5cfa2';
    const drawKey = () => {
      ctx.beginPath();
      ctx.arc(x - size * .27, y - size * .28, size * .32, 0, Math.PI * 2);
      ctx.moveTo(x, y); ctx.lineTo(x + size * .83, y + size * 1.32);
      ctx.lineTo(x + size * .54, y + size * 1.47);
      ctx.moveTo(x + size * .56, y + size * .96);
      ctx.lineTo(x + size * .30, y + size * 1.1);
      ctx.stroke();
    };
    ctx.lineWidth = Math.max(1.1, radius * .048);
    ctx.lineCap = 'round';
    drawKey();
    if (residue > 0) {
      ctx.globalAlpha = residue;
      ctx.strokeStyle = kind === 'mud' ? '#6b523b' : '#a45433';
      drawKey();
    }
    ctx.fillStyle = kind === 'mud' ? '#977455' : '#ad653f';
    for (let i = 0; i < 4; i++) {
      const fall = (now * .004 + i * .19) % 1;
      ctx.globalAlpha = drip * (1 - fall);
      ctx.beginPath();
      ctx.ellipse(x + (i - 1.5) * size * .20, y + size * (1.5 + fall * .9), size * .13, size * .20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  keys.forEach(key => {
    const index = key.bathSlot;
    const progress = bathKeyProgress(key, kind, wallTime);
    const dip = kind === 'mud' ? waterDip(progress) : null;
    if (dip && dip.height < -.05) return;
    ctx.globalAlpha = dip ? Math.min(1, .45 + dip.height * 3) : .55;
    const x = kind === 'rust' ? (index - 1.5) * .41 : (index % 2 ? .32 : -.32);
    const y = kind === 'rust' ? 0 : (index < 2 ? -.09 : .09) - (dip?.height || 0) * 2.5;
    paint(center.x + x * radius, center.y + y * radius,
      dip?.remaining ?? 1, dip?.drip || 0);
  });
  if (lift) {
    const progress = Math.min(1, Math.max(0, (now - lift.startedAt) / BATH_LIFT_MS));
    paint(center.x, center.y - Math.min(1, progress * 2.1) * radius * .88,
      kind === 'rust' ? Math.max(0, 1 - (progress - .16) * 1.65) : 0, Math.sin(progress * Math.PI));
  }
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
