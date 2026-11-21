import * as THREE from 'three';
import { makeCityWindowTexture, makeCityDepthTexture, makeCurtainLinenTexture } from '../materials.js';

// The arched window on the far wall, the city behind it and the curtains.
export function buildWindow(kit) {
  const { m, staticGroup, animated, shadow, paintedWood, woodPeriod, box, rod } = kit;
  // A real recessed opening with three painted exterior planes at different
  // distances; camera rotation creates parallax through the transparent glass.
  const exterior = new THREE.Group();
  exterior.name = 'city-view-parallax';
  staticGroup.add(exterior);
  const addCityPlane = (name, texture, width, height, x, y, z, translucent = false) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
      map: texture, toneMapped: false, fog: false, side: THREE.DoubleSide,
      transparent: translucent, depthWrite: !translucent,
    }));
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.frustumCulled = true;
    exterior.add(mesh);
    return mesh;
  };
  addCityPlane('city-distant-panorama', makeCityWindowTexture(), 48, 24, -.05, 5.7, -32);
  addCityPlane('city-middle-rooftops', makeCityDepthTexture('middle'), 25, 10.5, -.35, 3.6, -17.5, true);
  addCityPlane('city-near-canalside', makeCityDepthTexture('near'), 14.4, 8.0, -.15, 2.05, -9.4, true);

  const window = new THREE.Group();
  window.name = 'main-arched-window';
  // Timber sits within the 27 cm masonry, behind its front face at z=-5.485.
  window.position.set(-.05, 2.23, -5.65);
  staticGroup.add(window);
  const halfWidth = 4.15, straightHeight = 5.20, archRise = 2.10;
  const archProfile = (half, spring, rise, base = 0) => {
    const shape = new THREE.Shape();
    shape.moveTo(-half, base);
    shape.lineTo(half, base);
    shape.lineTo(half, spring);
    for (let i = 1; i <= 64; i++) {
      const a = i * Math.PI / 64;
      shape.lineTo(half * Math.cos(a), spring + rise * Math.sin(a));
    }
    shape.closePath();
    return shape;
  };
  const glassShape = archProfile(halfWidth - .18, straightHeight - .05, archRise - .16, .08);
  const glassGeometry = new THREE.ShapeGeometry(glassShape, 64);
  const glass = new THREE.Mesh(glassGeometry,
    new THREE.MeshPhysicalMaterial({ color: '#c7d7d0', roughness: .17, metalness: .04,
      clearcoat: .45, clearcoatRoughness: .12, transparent: true, opacity: .10,
      depthWrite: false, side: THREE.DoubleSide }));
  glass.name = 'main-arched-window-glass';
  glass.position.z = -.055;
  glass.castShadow = false;
  window.add(glass);

  const makeArchTrim = (half, spring, rise, radius, material, z) => {
    const points = [];
    for (let i = 0; i <= 48; i++) {
      const a = i * Math.PI / 48;
      points.push(new THREE.Vector3(half * Math.cos(a), spring + rise * Math.sin(a), z));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(curve, 80, radius, 8, false);
    if (paintedWood.has(material)) {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i,
        uv.getX(i) * curve.getLength() / woodPeriod,
        uv.getY(i) * 2 * Math.PI * radius / woodPeriod);
      uv.needsUpdate = true;
    }
    const trim = shadow(new THREE.Mesh(geometry, material));
    window.add(trim);
    return trim;
  };
  for (const side of [-1, 1]) {
    box(window, .25, straightHeight, .27, m.walnut, side * (halfWidth - .05), straightHeight / 2, .19, .045);
    box(window, .045, straightHeight, .065, m.oldBrass, side * (halfWidth - .22), straightHeight / 2, .32);
  }
  makeArchTrim(halfWidth - .05, straightHeight, archRise, .15, m.walnut, .19).name = 'main-arched-window-frame';
  makeArchTrim(halfWidth - .22, straightHeight - .05, archRise - .16, .048, m.oldBrass, .32);
  box(window, 8.65, .22, .48, m.walnut, 0, -.02, .37, .035).name = 'main-arched-window-sill';
  box(window, 8.01, .085, .13, m.oldBrass, 0, .13, .35);
  // All mullions meet the arched glazing: no floating rectangular top rail.
  for (const x of [-2.02, 0, 2.02]) {
    const roof = straightHeight - .05 + (archRise - .16) * Math.sqrt(1 - (x / (halfWidth - .18)) ** 2);
    box(window, .115, roof - .08, .13, m.darkWood, x, (roof + .08) / 2, .25);
  }
  for (const y of [2.68, straightHeight - .04]) box(window, 7.94, .11, .14, m.darkWood, 0, y, .24);
  // Dense woven linen with actual pleated geometry. The fixed top edge is
  // suspended from a wall-wide brass pole level with the upper crossbar.
  rod(window, [-4.13, straightHeight - .04, .55], [4.13, straightHeight - .04, .55], .043, m.oldBrass, 12)
    .name = 'curtain-pole-full-width';
  const curtainMap = makeCurtainLinenTexture();
  const curtainMaterial = new THREE.MeshPhysicalMaterial({
    map: curtainMap, color: '#d6e0d7', roughness: .91, metalness: 0,
    sheen: .6, sheenColor: '#b6cbc5', sheenRoughness: .9,
    side: THREE.DoubleSide,
  });
  curtainMaterial.userData.inkSkipOutline = true; // the cloth deforms every frame
  for (const sign of [-1, 1]) {
    const width = .96, height = 5.10;
    const geometry = new THREE.PlaneGeometry(width, height, 28, 42);
    const positions = geometry.getAttribute('position');
    positions.setUsage(THREE.DynamicDrawUsage);
    const rest = new Float32Array(positions.array);
    const sideName = sign < 0 ? 'left' : 'right';
    const cloth = new THREE.Mesh(geometry, curtainMaterial);
    cloth.name = `window-curtain-${sideName}`;
    cloth.userData.windAnimated = true;
    cloth.position.set(sign * 3.78, 2.57, .56);
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    cloth.frustumCulled = false;
    window.add(cloth);
    const updateCloth = time => {
      const phase = time * 1.18 + (sign < 0 ? .35 : 1.9);
      for (let i = 0; i < positions.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1];
        const height01 = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1);
        const freedom = (1 - height01) ** 1.7; // the sewn upper seam stays fixed
        const u = (x + width / 2) / width;
        const pleat = .105 * Math.sin(u * Math.PI * 6.0 + .28 * (1 - height01));
        const wind = Math.sin(phase + u * 1.8) * .12 + Math.sin(time * .53 + u * 3.8) * .045;
        positions.setXYZ(i,
          x * (.81 + .19 * freedom) + sign * freedom * wind,
          y - freedom * (.018 + .015 * Math.sin(phase + u * 5.0)),
          pleat + freedom * (.17 * Math.sin(phase * .83 + u * 1.5) + .054 * Math.sin(time * 2.1 + u * 4.0)));
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    };
    updateCloth(0);
    animated.push(updateCloth);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.056, .015, 6, 12), m.oldBrass);
      ring.position.set(sign * 3.78 + (i - 2) * .18, straightHeight - .078, .62);
      ring.castShadow = false;
      window.add(ring);
    }
  }
  // Broad translucent sunlight falls across the central table.
  const beamMat = new THREE.MeshBasicMaterial({ color: '#f7d3a0', transparent: true, opacity: .036, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.4, 8.4, 4, 1, true), beamMat);
  beam.rotation.x = -.55; beam.position.set(-.25, 3.85, -2.5); staticGroup.add(beam);
}
