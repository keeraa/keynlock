export function buildCentralFloor({ THREE, layout, m, stair, mesh, shapeMesh, circle }) {
  shapeMesh(layout.perimeter, [circle(stair.openingRadius)], -.22, .22, m.stone);

  // A thin brass border and six flush lozenges mark the approaches to the halls.
  const border = stair.openingRadius + .35;
  for (const [radius, width] of [[border, .06], [border + .23, .025]]) {
    const ring = new THREE.RingGeometry(radius, radius + width, 96);
    ring.rotateX(-Math.PI / 2);
    mesh(ring, m.gold).position.y = .007;
  }
  for (const hall of layout.halls) {
    const marker = new THREE.Shape();
    marker.moveTo(0, .52);
    marker.lineTo(.15, 0);
    marker.lineTo(0, -.52);
    marker.lineTo(-.15, 0);
    marker.closePath();
    const inlay = mesh(new THREE.ShapeGeometry(marker), m.gold);
    inlay.rotation.order = 'YXZ';
    inlay.rotation.set(-Math.PI / 2, hall.angle, 0);
    const point = layout.world(hall, 0, border + 1.03);
    inlay.position.set(point.x, .007, point.z);
  }
}
