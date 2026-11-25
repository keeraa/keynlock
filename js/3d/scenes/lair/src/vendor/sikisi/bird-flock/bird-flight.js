// Smooth steering towards changing destinations, each bird at its own altitude.
// Generalised from KEYNLOCK art-archive (src/environment/bird-flight.js): the sky is a disc
// of `radius` around `center` starting at `height`, instead of the archive dome.
export function createBirdFlight(THREE, index, { height, radius = 23, center = { x: 0, z: 0 } }, random = Math.random) {
  const position = new THREE.Vector3(center.x + Math.sin(index * 2.4) * radius * .43, height + 2 + index, center.z + Math.cos(index * 2.4) * radius * .43);
  const target = new THREE.Vector3(), velocity = new THREE.Vector3();
  let heading = index * 2.4, climb = 0, remaining = 0, bank = 0, pitch = 0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function destination() {
    // Cross the sky, changing both travel distance and altitude.
    const angle = heading + (random() - .5) * Math.PI * 1.8;
    const distance = radius * (.43 + random() * .65);
    target.set(position.x + Math.sin(angle) * distance, height + 1.8 + random() * 7, position.z + Math.cos(angle) * distance);
    const dx = target.x - center.x, dz = target.z - center.z, r = Math.hypot(dx, dz);
    if (r > radius) { target.x = center.x + dx * radius / r; target.z = center.z + dz * radius / r; }
    remaining = 5 + random() * 5;
  }
  function update(dt, gliding) {
    if (dt <= 0) return { position, heading, bank, pitch, climb };
    remaining -= dt;
    if (remaining <= 0 || Math.hypot(target.x - position.x, target.z - position.z) < 3) destination();
    // Near the edge, steer back to the inner sky before choosing another destination.
    const ox = position.x - center.x, oz = position.z - center.z, edge = Math.hypot(ox, oz) > radius * 1.09;
    const x = edge ? -ox : target.x - position.x, z = edge ? -oz : target.z - position.z;
    const change = Math.max(-.7 * dt, Math.min(.7 * dt, wrap(Math.atan2(x, z) - heading)));
    heading += change;
    const speed = gliding ? 3.5 : 3;
    const desiredClimb = Math.max(-1.3, Math.min(1.3, (target.y - position.y) * .6));
    climb += (desiredClimb - climb) * (1 - Math.exp(-1.6 * dt));
    velocity.set(Math.sin(heading) * speed, climb, Math.cos(heading) * speed);
    position.addScaledVector(velocity, dt);
    bank += (-Math.max(-.5, Math.min(.5, change / dt * .65)) - bank) * (1 - Math.exp(-3 * dt));
    pitch += (Math.atan2(climb, speed) - pitch) * (1 - Math.exp(-3 * dt));
    return { position, heading, bank, pitch, climb };
  }
  return { update, resume(point, yaw, slope = 0, roll = 0) { position.copy(point); heading = yaw; climb = Math.tan(slope) * 3; bank = roll; pitch = slope; remaining = 0; } };
}
