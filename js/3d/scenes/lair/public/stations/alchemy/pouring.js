// World-space pouring pose for upright-y containers rotated around the Z axis.
// The open rim must be lower than the sealed bottom for liquid to pour.
export const POUR_ANGLE = 1.97; // ~113°, measured from the upright position.

export function pouringPose({ targetX, targetZ, targetRimY, targetRadius = .504, sourceHeight, side }) {
  if (side !== 1 && side !== -1) throw new Error('Pour side must be -1 or 1');
  const angle = side * POUR_ANGLE;
  // Keep the source lip just outside the receiving rim at any vessel size;
  // the tilted, gravity-curved stream then enters its actual open mouth.
  const mouthX = targetX + side * (targetRadius + .026);
  const mouthY = targetRimY + .28;
  const mouthZ = targetZ + targetRadius * .32;
  return {
    angle,
    x: mouthX + Math.sin(angle) * sourceHeight,
    y: mouthY - Math.cos(angle) * sourceHeight,
    z: mouthZ,
    mouthX,
    mouthY,
    mouthZ
  };
}

export function mouthFromPose(pose, sourceHeight) {
  return {
    x: pose.x - Math.sin(pose.angle) * sourceHeight,
    y: pose.y + Math.cos(pose.angle) * sourceHeight,
    z: pose.z
  };
}
