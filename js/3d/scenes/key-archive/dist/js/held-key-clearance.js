import { Box3 } from '../vendor/three.js';

const AXES = ['x', 'y', 'z'];

// The key moves and scales together along the view ray, keeping its apparent
// size. Its bounding box grows from the eye to the full carry pose.
export function createHeldKeyClearance(obstacles) {
  const sweep = new Box3();
  return function limit(origin, keyBounds) {
    sweep.copy(keyBounds).expandByPoint(origin);
    let closest = 1;

    obstacle: for (const solid of obstacles) {
      if (!solid.intersectsBox(sweep) || solid.containsPoint(origin)) continue;
      let enter = 0;
      let exit = closest;
      for (const axis of AXES) {
        const eye = origin[axis];
        const min = solid.min[axis] - eye;
        const max = solid.max[axis] - eye;
        const lowerEdge = keyBounds.min[axis] - eye;
        const upperEdge = keyBounds.max[axis] - eye;
        // Solve upperEdge * scale >= min and lowerEdge * scale <= max.
        if (upperEdge > 0) enter = Math.max(enter, min / upperEdge);
        else if (upperEdge < 0) exit = Math.min(exit, min / upperEdge);
        else if (min > 0) continue obstacle;
        if (lowerEdge < 0) enter = Math.max(enter, max / lowerEdge);
        else if (lowerEdge > 0) exit = Math.min(exit, max / lowerEdge);
        else if (max < 0) continue obstacle;
        if (enter > exit) continue obstacle;
      }
      closest = enter;
    }
    return closest;
  };
}
