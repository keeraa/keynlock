import { Box3, Vector3 } from 'three';
import { ROOM_CEILING_Y, ROOM_END, ROOM_FLOOR_Y, ROOM_WALL_X, ROOM_WINDOW_WALL_Z } from '../room-layout.js';

const interior = new Box3(
  new Vector3(-ROOM_WALL_X, ROOM_FLOOR_Y, ROOM_WINDOW_WALL_Z),
  new Vector3(ROOM_WALL_X, ROOM_CEILING_Y, ROOM_END),
);
// Leave room for the near plane and the trim before the masonry.
const cameraInterior = interior.clone().expandByScalar(-.26);

export function constrainRoomCameraPosition(position) {
  return cameraInterior.clampPoint(position, position);
}

export function constrainRoomCameraTarget(target) {
  return interior.clampPoint(target, target);
}

/** Keep orbit, pan and camera flights inside the same closed room. */
export function constrainRoomCamera(camera, target) {
  const moved = !cameraInterior.containsPoint(camera.position);
  const retargeted = !interior.containsPoint(target);
  if (retargeted) constrainRoomCameraTarget(target);
  if (moved) constrainRoomCameraPosition(camera.position);
  if ((moved || retargeted) && camera.position.distanceToSquared(target) > 1e-8) camera.lookAt(target);
}
