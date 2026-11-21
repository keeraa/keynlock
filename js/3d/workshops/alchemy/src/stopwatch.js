// A real 20-second mechanical stopwatch. The case is square and the raised
// pointer completes one clockwise revolution in four five-second intervals.
export function createStopwatch(THREE, parent, materials, position) {
  const root = new THREE.Group();
  root.name = '20-second-stopwatch';
  root.position.set(...position);
  parent.add(root);

  const part = (geometry, material, x, y, z) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = false;
    object.receiveShadow = false;
    root.add(object);
    return object;
  };
  const caseMetal = materials.brass;
  const ink = new THREE.MeshBasicMaterial({ color: 0x40372d });
  const handRed = new THREE.MeshBasicMaterial({ color: 0xc74d2c });
  const face = new THREE.MeshStandardMaterial({ color: 0xf0dfaf, roughness: .93, metalness: 0 });
  const inset = new THREE.MeshStandardMaterial({ color: 0x3e3931, roughness: .67, metalness: .3 });
  const box = (w, h, d, material, x, y, z) =>
    part(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  box(1.08, 1.20, .17, materials.darkWood, 0, 0, 0);
  box(1.0, 1.12, .018, caseMetal, 0, 0, .098);
  box(.935, 1.055, .018, inset, 0, 0, .111);
  box(.887, 1.01, .016, face, 0, 0, .123);
  box(.88, .060, .20, caseMetal, 0, -.55, .032); // base on the shelf
  box(.24, .11, .18, caseMetal, 0, .638, .017);

  // All engraved ticks and number strokes share ONE instanced draw call.
  const marks = [];
  const mark = (w, h, x, y, z, angle = 0) => marks.push({ w, h, x, y, z, angle });
  // Four prominent strokes, each 5 seconds apart, plus single-second ticks.
  for (let second = 0; second < 20; second++) {
    const angle = -second / 20 * Math.PI * 2;
    const major = second % 5 === 0;
    const outer = .441, inward = major ? .10 : .04;
    mark(major ? .027 : .011, inward,
      Math.sin(angle) * (outer - inward / 2), Math.cos(angle) * (outer - inward / 2), .146, -angle);
  }

  const digitSegments = {
    0: [0, 1, 2, 4, 5, 6], 1: [2, 5], 2: [0, 2, 3, 4, 6],
    3: [0, 2, 3, 5, 6], 4: [1, 2, 3, 5], 5: [0, 1, 3, 5, 6]
  };
  const segments = [
    [0, .034, .056, .010], [-.026, .018, .010, .039],
    [.026, .018, .010, .039], [0, 0, .056, .010],
    [-.026, -.018, .010, .039], [.026, -.018, .010, .039],
    [0, -.034, .056, .010]
  ];
  for (const [label, x, y] of [['20', 0, .280], ['5', .306, 0], ['10', 0, -.290], ['15', -.308, 0]]) {
    const chars = [...label];
    const spacing = .066;
    chars.forEach((char, digit) => {
      for (const segment of digitSegments[Number(char)]) {
        const [sx, sy, w, h] = segments[segment];
        mark(w, h, x + (digit - (chars.length - 1) / 2) * spacing + sx, y + sy, .150);
      }
    });
  }
  const engraving = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ink, marks.length);
  engraving.name = 'stopwatch-engraved-marks';
  engraving.castShadow = engraving.receiveShadow = false;
  const dummy = new THREE.Object3D();
  marks.forEach(({ w, h, x, y, z, angle }, index) => {
    dummy.position.set(x, y, z);
    dummy.rotation.z = angle;
    dummy.scale.set(w, h, .009);
    dummy.updateMatrix();
    engraving.setMatrixAt(index, dummy.matrix);
  });
  engraving.instanceMatrix.needsUpdate = true;
  root.add(engraving);

  const hand = new THREE.Group();
  hand.name = 'stopwatch-pointer';
  hand.position.z = .168;
  root.add(hand);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(.032, .30, .016), ink);
  needle.position.y = .13;
  hand.add(needle);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.043, .11, 3), handRed);
  tip.position.y = .31;
  hand.add(tip);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.065, .105, .015), ink);
  tail.position.y = -.05;
  hand.add(tail);
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(.044, 12, 8), caseMetal);
  pivot.position.z = .018;
  hand.add(pivot);

  const stopwatch = {
    root, hand, elapsed: 0, running: false, duration: 20,
    start() { this.elapsed = 0; this.running = true; this.hand.rotation.z = 0; },
    stop() { this.running = false; },
    reset() { this.elapsed = 0; this.running = false; this.hand.rotation.z = 0; },
    tick(dt) {
      if (!this.running) return;
      this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
      this.hand.rotation.z = -this.elapsed / this.duration * 2 * Math.PI;
      if (this.elapsed >= this.duration) this.running = false;
    }
  };
  return stopwatch;
}
