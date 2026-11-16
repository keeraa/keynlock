import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCityWindowTexture, makeCityDepthTexture, makeCurtainLinenTexture, makeMapTexture } from './materials.js';
import { createAmbientParticles } from './engine/ambient-particles.js';

/** A single continuous room, using the proportions and gouache materials of the existing ateliers. */
export function buildLair(scene, m) {
  const anchors = {};
  const hitTargets = [];
  const animated = [];
  const artTextures = new Map();
  let rightWallFinish = null;
  let ambientParticles = null;
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const shadow = mesh => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
  const paintedWood = new Set([m.walnut, m.agedWood, m.darkWood, m.ash, m.oak]);
  const woodPeriod = 1.45;
  // Scale each face by real-world dimensions so narrow rails don't squeeze an
  // entire gouache texture into a few centimetres of timber.
  const sizeWoodBoxUV = (geometry, w, h, d) => {
    const uv = geometry.getAttribute('uv');
    const index = geometry.getIndex();
    const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const visited = new Set();
    for (let face = 0; face < Math.min(6, geometry.groups.length); face++) {
      const { start, count } = geometry.groups[face];
      const [width, height] = faces[face];
      for (let i = start; i < start + count; i++) {
        const vertex = index ? index.getX(i) : i;
        if (visited.has(vertex)) continue;
        visited.add(vertex);
        uv.setXY(vertex, uv.getX(vertex) * width / woodPeriod, uv.getY(vertex) * height / woodPeriod);
      }
    }
    uv.needsUpdate = true;
    geometry.userData.paintedWoodUV = true;
  };
  const box = (parent, w, h, d, material, x = 0, y = 0, z = 0, bevel = 0) => {
    const geometry = bevel ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d);
    if (paintedWood.has(material)) sizeWoodBoxUV(geometry, w, h, d);
    const mesh = shadow(new THREE.Mesh(geometry, material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const cylinder = (parent, rt, rb, h, material, x, y, z, segments = 18) => {
    const mesh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const sphere = (parent, r, material, x, y, z, segments = 16) => {
    const mesh = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, segments, 10), material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const rod = (parent, a, b, radius, material, sides = 8) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius * .92, radius, direction.length(), sides);
    if (paintedWood.has(material)) {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i,
        uv.getX(i) * 2 * Math.PI * radius / woodPeriod,
        uv.getY(i) * direction.length() / woodPeriod);
      uv.needsUpdate = true;
    }
    const mesh = shadow(new THREE.Mesh(geometry, material));
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    parent.add(mesh); return mesh;
  };
  const plane = (parent, w, h, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z); parent.add(mesh); mesh.receiveShadow = true; return mesh;
  };
  const label = (parent, text, x, y, z, width = 1.8, height = .3) => {
    const texture = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#c4aa79'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#695335'; ctx.lineWidth = 14; ctx.strokeRect(13, 13, w - 26, h - 26);
      ctx.fillStyle = '#382d20'; ctx.font = `bold ${Math.min(88, Math.floor(1420 / text.length))}px Georgia`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2);
    }, 1024, 180);
    return plane(parent, width, height, new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }), x, y, z);
  };
  const station = (id, position, size) => {
    anchors[id] = new THREE.Vector3(...position);
    const collider = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    collider.position.set(...position);
    collider.userData.zone = id;
    scene.add(collider); hitTargets.push(collider);
  };

  function buildShell() {
    scene.background = new THREE.Color('#2f3834');
    scene.fog = new THREE.Fog('#514d40', 25, 48);
    const floorBase = box(staticGroup, 17.3, .22, 13.8, m.darkWood, 0, -.14, .4);
    floorBase.castShadow = false;
    for (let i = 0; i < 38; i++) {
      const z = -5.64 + i * .325;
      const plank = box(staticGroup, 17.1, .047, .312, i % 6 === 0 ? m.floorAlternate : m.floor, 0, .015, z);
      plank.castShadow = false;
      if (i % 5 === 0) box(staticGroup, 17.1, .006, .009, m.darkWood, 0, .045, z - .155).castShadow = false;
    }
    // Double-height room, measured from the same floor datum as the original.
    // The arched opening runs all the way through the plaster. A solid box
    // would occlude any exterior scenery and leave the glass looking painted on.
    const backOutline = new THREE.Shape();
    backOutline.moveTo(-8.7, -.14);
    backOutline.lineTo(8.7, -.14);
    backOutline.lineTo(8.7, 13.66);
    backOutline.lineTo(-8.7, 13.66);
    backOutline.closePath();
    const opening = new THREE.Path();
    const openingX = -.05, openingHalf = 4.23, openingBottom = 2.13;
    const openingSpring = 7.43, openingRise = 2.15;
    opening.moveTo(openingX - openingHalf, openingBottom);
    opening.lineTo(openingX - openingHalf, openingSpring);
    for (let i = 1; i <= 64; i++) {
      const angle = Math.PI - Math.PI * i / 64;
      opening.lineTo(openingX + openingHalf * Math.cos(angle), openingSpring + openingRise * Math.sin(angle));
    }
    opening.lineTo(openingX + openingHalf, openingBottom);
    opening.closePath();
    backOutline.holes.push(opening);
    const wallGeometry = new THREE.ExtrudeGeometry(backOutline, { depth: .27, bevelEnabled: false, curveSegments: 64 });
    // ExtrudeGeometry uses world-unit cap UVs; normalize so the gouache scale
    // still matches the original single-piece plaster wall.
    const wallPosition = wallGeometry.getAttribute('position');
    const wallUV = wallGeometry.getAttribute('uv');
    const cap = wallGeometry.groups[0];
    for (let i = cap.start; i < cap.start + cap.count; i++) {
      wallUV.setXY(i, (wallPosition.getX(i) + 8.7) / 17.4, (wallPosition.getY(i) + .14) / 13.8);
    }
    wallUV.needsUpdate = true;
    const backWall = new THREE.Mesh(wallGeometry, m.plaster);
    backWall.name = 'back-wall-arched-cutout';
    backWall.position.z = -5.755;
    backWall.receiveShadow = true;
    staticGroup.add(backWall);
    box(staticGroup, .27, 13.8, 13.0, m.plaster, -8.55, 6.76, .75).castShadow = false;
    box(staticGroup, .27, 13.8, 13.0, m.plaster, 8.55, 6.76, .75).castShadow = false;
    box(staticGroup, 17.5, .20, 13.5, m.darkWood, 0, 13.62, .65).castShadow = false;
    // The left wall keeps the exact ochre gouache wallpaper from the atelier.
    const leftFinish = plane(staticGroup, 12.88, 13.55, m.restorationWall, -8.391, 6.72, .75);
    leftFinish.rotation.y = Math.PI / 2;
    leftFinish.name = 'restoration-left-wall';
    // One continuous sage-green tiled finish covers the entire right wall.
    // It sits just in front of the plaster, from the floor to the ceiling.
    const rightFinish = plane(staticGroup, 13.0, 13.54, m.alchemyTile, 8.392, 6.77, .75);
    rightFinish.rotation.y = -Math.PI / 2;
    rightFinish.castShadow = false;
    rightFinish.name = 'alchemy-right-wall';
    rightWallFinish = rightFinish;

    // Wainscot panels, framed with dark timber; the left wall is kept free for the restoration easel.
    box(staticGroup, 17.25, 1.65, .08, m.agedWood, 0, .9, -5.39);
    box(staticGroup, 17.25, .12, .17, m.darkWood, 0, 1.76, -5.28);
    box(staticGroup, 17.25, .2, .23, m.walnut, 0, .18, -5.26);
    for (let i = -7; i <= 7; i++) {
      box(staticGroup, .09, 1.45, .09, m.darkWood, i * 1.18, .93, -5.31);
      if (i < 7) box(staticGroup, .92, .04, .045, m.oldBrass, i * 1.18 + .59, 1.49, -5.23);
    }
    // The restoration side retains its wood wainscot. Keep the tiled side clear.
    box(staticGroup, .08, 1.66, 12.9, m.agedWood, -8.35, .88, .75);
    box(staticGroup, .19, .15, 12.9, m.darkWood, -8.23, 1.77, .75);
    box(staticGroup, .22, .20, 12.9, m.walnut, -8.20, .17, .75);
    // No timber line across the middle of the double-height room.
    for (const side of [-1, 1]) box(staticGroup, .22, .20, 12.9, m.walnut, side * 8.29, 13.30, .75);
    // Leave the centre of the back wall open for the enlarged arched window.
    for (const x of [-8.25, -4.68, 4.68, 8.25]) {
      box(staticGroup, .31, 13.35, .32, m.darkWood, x, 6.64, -5.32);
      box(staticGroup, .45, .22, .48, m.walnut, x, 12.70, -5.31);
    }
    for (const z of [-4.8, -1.7, 1.4, 4.5]) {
      box(staticGroup, 17.15, .30, .34, m.darkWood, 0, 13.37, z);
      for (const x of [-8.15, 8.15]) box(staticGroup, .42, .44, .52, m.walnut, x, 13.22, z);
    }
    box(staticGroup, 17.22, .25, .32, m.walnut, 0, 13.24, -5.29);
    // Small warm chandeliers make the extra storey visually legible.
    for (const z of [-2.6, 2.7]) {
      cylinder(staticGroup, .042, .042, 1.25, m.oldBrass, 0, 12.54, z, 10);
      cylinder(staticGroup, .34, .27, .15, m.oldBrass, 0, 11.89, z, 16);
      const globe = sphere(staticGroup, .25, new THREE.MeshBasicMaterial({ color: '#ffdfaa' }), 0, 11.75, z);
      globe.castShadow = false;
      const light = new THREE.PointLight('#ffd6a3', 6, 9, 2);
      light.position.set(0, 11.75, z); staticGroup.add(light);
    }
    // A worn, woven carpet beneath the central table.
    const rugTex = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#625d4c'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#928065'; ctx.lineWidth = 20; ctx.strokeRect(50, 50, w - 100, h - 100);
      ctx.strokeStyle = '#423d35'; ctx.lineWidth = 8; ctx.strokeRect(83, 83, w - 166, h - 166);
      for (let x = 130; x < w - 100; x += 115) for (let y = 150; y < h - 100; y += 115) {
        ctx.strokeStyle = '#968c73'; ctx.lineWidth = 6; ctx.beginPath();
        ctx.moveTo(x, y - 30); ctx.lineTo(x + 30, y); ctx.lineTo(x, y + 30); ctx.lineTo(x - 30, y); ctx.closePath(); ctx.stroke();
      }
    });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.3), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-.1, .05, 1.2); rug.receiveShadow = true; staticGroup.add(rug);
  }

  function framedPainting(parent, width, height, artName, x, y, z, yaw = 0, options = {}) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = yaw; parent.add(group);
    const frame = options.frameMaterial || m.walnut;
    const innerFrame = options.innerFrameMaterial || m.oldBrass;
    box(group, width + .13, height + .13, .1, options.backingMaterial || m.darkWood, 0, 0, 0);
    if (!artTextures.has(artName)) {
      const image = new THREE.TextureLoader().load(`/assets/${artName}`);
      image.colorSpace = THREE.SRGBColorSpace;
      artTextures.set(artName, image);
    }
    const art = artTextures.get(artName);
    const artwork = new THREE.Mesh(new THREE.PlaneGeometry(width - .09, height - .09), new THREE.MeshStandardMaterial({ map: art, roughness: 1 }));
    artwork.position.z = .063; group.add(artwork);
    if (options.weathered) {
      // The restoration canvas carries a translucent, irregular painted patina.
      const washMap = canvasTexture((ctx, w, h) => {
        let seed = 712;
        const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
        ctx.fillStyle = 'rgba(211,188,153,.33)'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 620; i++) {
          ctx.fillStyle = `rgba(${178 + Math.floor(random() * 55)},${151 + Math.floor(random() * 47)},${125 + Math.floor(random() * 47)},${.017 + random() * .11})`;
          ctx.fillRect(random() * w, random() * h, 4 + random() * 48, 1 + random() * 19);
        }
      }, 512, 512);
      const patina = new THREE.Mesh(new THREE.PlaneGeometry(width - .09, height - .09), new THREE.MeshBasicMaterial({ map: washMap, transparent: true, opacity: .81, depthWrite: false }));
      patina.name = 'restoration-weathered-patina';
      patina.position.z = .071;
      group.add(patina);
    }
    for (const side of [-1, 1]) {
      box(group, .115, height + .32, .16, frame, side * (width / 2 + .05), 0, .08, .02);
      box(group, width + .32, .115, .16, frame, 0, side * (height / 2 + .05), .08, .02);
      box(group, .016, height + .09, .05, innerFrame, side * (width / 2 - .025), 0, .17);
      box(group, width + .09, .016, .05, innerFrame, 0, side * (height / 2 - .025), .17);
    }
    return group;
  }

  function buildWindow() {
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

  function makeTable(parent, w, d, x, z, topY = .94) {
    const table = new THREE.Group(); table.position.set(x, 0, z); parent.add(table);
    box(table, w, .2, d, m.walnut, 0, topY, 0, .04);
    box(table, w - .16, .12, d - .16, m.darkWood, 0, topY - .15, 0);
    for (const xx of [-w / 2 + .19, w / 2 - .19]) for (const zz of [-d / 2 + .19, d / 2 - .19]) {
      box(table, .16, topY - .1, .18, m.agedWood, xx, (topY - .1) / 2, zz);
      box(table, .22, .12, .21, m.darkWood, xx, .07, zz);
    }
    box(table, w - .27, .13, .08, m.darkWood, 0, topY - .38, d / 2 - .20);
    return table;
  }

  function bottle(parent, x, y, z, color, height = .42, radius = .14) {
    cylinder(parent, radius, radius * 1.07, height, m.glass, x, y, z, 16);
    cylinder(parent, radius * .86, radius * .87, height * .44, color, x, y - height * .22, z, 16).castShadow = false;
    cylinder(parent, radius * .38, radius * .44, .11, m.oldBrass, x, y + height / 2 + .05, z, 12);
    cylinder(parent, radius * .43, radius * .43, .075, m.darkWood, x, y + height / 2 + .13, z, 12);
  }

  function brush(parent, x, y, z, rotation = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotation; parent.add(g);
    rod(g, [0, 0, -.22], [0, 0, .26], .017, m.ash, 8);
    rod(g, [0, 0, .22], [0, 0, .31], .019, m.oldBrass, 8);
    const nib = rod(g, [0, 0, .30], [0, 0, .44], .021, m.charcoal, 8);
    nib.scale.x = .83; return g;
  }

  function buildRestoration() {
    // A straight-on recreation of the original Atelier de Couleur restoration wall.
    framedPainting(staticGroup, 1.62, 1.96, 'girl-pearl.jpg', -8.28, 5.59, -4.18, Math.PI / 2);
    framedPainting(staticGroup, 1.76, 1.22, 'great-wave.jpg', -8.28, 5.77, -.92, Math.PI / 2);
    framedPainting(staticGroup, 1.32, 1.45, 'starry-night.jpg', -8.28, 5.61, 3.35, Math.PI / 2);
    const sign = label(staticGroup, 'ATELIER DE COULEUR', -8.27, 4.52, -1.18, 2.35, .32);
    sign.rotation.y = Math.PI / 2;

    const easelCaption = (parent, caption, right) => {
      const titleMap = canvasTexture((ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.font = `${right ? 61 : 68}px Georgia`;
        ctx.fillStyle = '#fff0d4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#3e2718'; ctx.shadowBlur = 13;
        ctx.fillText(right ? `${caption} ↙` : `${caption} ↘`, w / 2, h / 2);
      }, 1024, 150);
      const title = plane(parent, right ? 2.55 : 1.65, .29,
        new THREE.MeshBasicMaterial({ map: titleMap, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 3.54, .61);
      title.name = right ? 'restoration-caption-work' : 'restoration-caption-reference';
      title.receiveShadow = false;
    };
    const makeEasel = (x, z, caption, isWork) => {
      const easel = new THREE.Group();
      easel.name = isWork ? 'restoration-easel-work' : 'restoration-easel-reference';
      easel.position.set(x, 0, z); easel.rotation.y = Math.PI / 2; staticGroup.add(easel);
      rod(easel, [-.81, .05, .34], [-.09, 3.75, -.10], .073, m.walnut);
      rod(easel, [.81, .05, .34], [.09, 3.75, -.10], .073, m.walnut);
      rod(easel, [0, .05, -1.00], [0, 3.12, -.22], .062, m.walnut);
      for (const xx of [-.81, .81]) box(easel, .21, .08, .35, m.darkWood, xx, .055, .33);
      box(easel, .22, .08, .35, m.darkWood, 0, .055, -1.00);
      box(easel, .14, 2.93, .15, m.walnut, 0, 2.28, -.13);
      box(easel, 2.21, .11, .27, m.darkWood, 0, 1.36, .34);
      box(easel, 2.21, .072, .07, m.walnut, 0, 1.43, .49);
      box(easel, .31, .12, .18, m.darkWood, 0, 3.20, .45);
      framedPainting(easel, 2.17, 1.74, 'starry-night.jpg', 0, 2.33, .44, 0,
        { frameMaterial: m.ash, backingMaterial: m.ash, innerFrameMaterial: m.oak, weathered: isWork });
      easelCaption(easel, caption, isWork);
      return easel;
    };
    // In a perpendicular view the reference is on the left and work on the right.
    makeEasel(-7.10, .30, 'ЭТАЛОН', false);
    makeEasel(-7.10, -2.51, 'ВАША РЕСТАВРАЦИЯ', true);

    const rugMap = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#b6a17b'; ctx.fillRect(0, 0, w, h);
      let seed = 405;
      const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = `rgba(236,219,180,${.015 + rnd() * .065})`;
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 13, 1 + rnd() * 5);
      }
      ctx.strokeStyle = 'rgba(108,85,59,.2)'; ctx.lineWidth = 12;
      ctx.strokeRect(20, 20, w - 40, h - 40);
    }, 512, 512);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 6.0),
      new THREE.MeshStandardMaterial({ map: rugMap, roughness: 1 }));
    rug.name = 'restoration-rug';
    rug.rotation.x = -Math.PI / 2; rug.position.set(-6.45, .057, -1.10);
    rug.receiveShadow = true; staticGroup.add(rug);

    const pigmentColors = [m.ruby, m.green, m.slate, m.liquidAmber, m.paperDark];
    // Paint shelves are actually attached to the left wall, including supports.
    for (const y of [2.55, 3.48, 4.41]) {
      box(staticGroup, .49, .11, 2.27, m.walnut, -8.09, y, 4.37, .021);
      for (const z of [3.48, 5.27]) box(staticGroup, .36, .38, .07, m.darkWood, -8.23, y - .23, z);
    }
    for (let i = 0; i < 12; i++) bottle(staticGroup, -8.02, 2.81 + Math.floor(i / 4) * .93,
      3.49 + (i % 4) * .58, pigmentColors[i % pigmentColors.length], .25 + (i % 2) * .07, .105);

    const table = makeTable(staticGroup, 2.11, .97, -6.60, -4.39, 1.04);
    table.name = 'restoration-paint-table';
    table.rotation.y = Math.PI / 2;
    table.scale.setScalar(.84);
    box(table, .95, .025, .62, m.linen, -.43, 1.035, -.09);
    for (let i = 0; i < 6; i++) brush(table, -.93 + i * .19, 1.047, .30, -.1 + i * .11);
    for (let i = 0; i < 5; i++) bottle(table, -.87 + i * .30, 1.22, -.29, pigmentColors[i], .29, .095);
    const palette = cylinder(table, .30, .32, .03, m.ash, .56, 1.055, .08, 24);
    palette.scale.z = .76;
    for (let i = 0; i < 5; i++) sphere(table, .045, pigmentColors[i], .46 + .11 * (i % 3), 1.080, -.01 + .10 * Math.floor(i / 3), 10).scale.y = .22;
    box(table, .41, .045, .32, m.canvas, .13, 1.075, -.18);
    cylinder(table, .14, .14, .023, m.oldBrass, .84, 1.085, -.20, 24);
    cylinder(table, .12, .12, .016, m.glassBlue, .84, 1.104, -.20, 24);
    rod(table, [.86, 1.1, -.09], [1.03, 1.11, .12], .023, m.walnut);

    const stool = new THREE.Group(); stool.position.set(-5.41, 0, -4.33); staticGroup.add(stool);
    cylinder(stool, .43, .40, .14, m.ash, 0, .57, 0, 24);
    for (const xx of [-.26, .26]) for (const zz of [-.25, .25]) rod(stool, [xx, .09, zz], [xx * .75, .55, zz * .75], .052, m.walnut);
    for (let i = 0; i < 3; i++) {
      const blank = new THREE.Group();
      blank.position.set(-8.0 + i * .045, .0, -4.65 + i * .20);
      blank.rotation.y = Math.PI / 2;
      blank.rotation.z = -.07 - i * .035;
      staticGroup.add(blank);
      box(blank, .98 + i * .11, 1.22 + i * .13, .055, m.canvas, 0, .76 + i * .04, 0);
      for (const side of [-1, 1]) {
        box(blank, .045, 1.27 + i * .13, .07, m.ash, side * (.51 + i * .055), .76 + i * .04, .025);
        box(blank, 1.06 + i * .11, .045, .07, m.ash, 0, .76 + i * .04 + side * (.63 + i * .065), .025);
      }
    }
    station('restoration', [-6.93, 2.28, -1.06], [3.28, 4.9, 6.90]);
  }

  function makePaper(parent, x, y, z, rotation = 0, size = [.53, .76]) {
    const sheet = box(parent, size[0], .013, size[1], m.paper, x, y, z);
    sheet.rotation.y = rotation;
    for (let i = 0; i < 6; i++) {
      const line = box(parent, size[0] * .64, .002, .005, m.paperDark, x, y + .009, z - size[1] * .31 + i * .07);
      line.rotation.y = rotation; line.castShadow = false;
    }
    return sheet;
  }

  function candle(parent, x, y, z) {
    cylinder(parent, .11, .11, .035, m.oldBrass, x, y, z);
    cylinder(parent, .061, .067, .35, m.paper, x, y + .195, z, 12);
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd391', transparent: true, opacity: .89, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.056, .18, 8), flameMat);
    flame.position.set(x, y + .48, z); parent.add(flame);
    animated.push(t => { flame.scale.set(.92 + Math.sin(t * 6) * .09, 1 + Math.sin(t * 9) * .15, .92); });
    const glow = new THREE.PointLight('#f8ad65', 2.2, 4.3, 2); glow.position.set(x, y + .53, z); parent.add(glow);
    return flame;
  }

  function buildPlanning() {
    const table = makeTable(staticGroup, 2.95, 1.95, -.05, 1.44, 1.05);
    table.name = 'planning-main-table';
    box(table, 2.63, .06, 1.7, m.leather, 0, 1.18, 0, .03);
    makePaper(table, -.52, 1.222, .08, -.16, [.75, 1.04]);
    makePaper(table, .48, 1.233, -.29, .12, [.75, 1.07]);
    box(table, .43, .12, .5, m.darkWood, -.97, 1.27, -.43, .02);
    box(table, .48, .04, .56, m.paperDark, -.97, 1.35, -.43);
    candle(table, 1.12, 1.20, -.62);
    cylinder(table, .17, .17, .025, m.brass, .12, 1.26, .59, 28);
    rod(table, [.13, 1.30, .61], [.45, 1.30, .58], .012, m.iron);
    // Ink bottle and quill.
    bottle(table, -1.12, 1.47, .58, m.charcoal, .31, .09);
    rod(table, [-.95, 1.31, .44], [-.64, 1.48, .15], .014, m.paper);
    const chair = new THREE.Group(); chair.position.set(-.25, 0, 3.12); staticGroup.add(chair);
    box(chair, .85, .14, .8, m.agedWood, 0, .58, 0, .04);
    for (const x of [-.3, .3]) for (const z of [-.25, .25]) rod(chair, [x, .05, z], [x, .58, z], .06, m.darkWood);
    box(chair, .85, .82, .14, m.agedWood, 0, 1.13, .32, .045);
    for (const y of [.83, 1.1, 1.36]) box(chair, .68, .04, .08, m.oldBrass, 0, y, .42);
    // The enlarged window leaves a narrow wall bay for the planning board.
    const board = new THREE.Group(); board.position.set(5.55, 3.37, -5.17); staticGroup.add(board);
    box(board, 2.27, 1.75, .10, m.darkWood);
    const map = makeMapTexture();
    plane(board, 2.05, 1.50, new THREE.MeshStandardMaterial({ map, roughness: 1 }), 0, 0, .072);
    for (const [x, y] of [[-.56,.42],[.48,-.25],[-.12,-.35]]) {
      sphere(board, .064, m.ruby, x, y, .12, 9);
      cylinder(board, .022, .027, .095, m.oldBrass, x, y, .12, 10).rotation.x = Math.PI / 2;
    }
    const shelf = box(staticGroup, 1.9, .12, .52, m.walnut, 5.45, 1.98, -4.96);
    shelf.castShadow = false;
    for (let i = 0; i < 5; i++) box(staticGroup, .15 + i * .022, .54 + (i % 2) * .16, .3, i % 2 ? m.ruby : m.leather, 4.71 + i * .24, 2.32 + (i % 2) * .08, -4.90);
    station('planning', [0, 1.42, 1.28], [3.4, 2.8, 2.6]);
  }

  function toolPegboard() {
    // The tool wall belongs to the workbench along the right-hand tiled wall.
    const pegboard = new THREE.Group(); pegboard.position.set(8.18, 3.22, 4.27);
    pegboard.rotation.y = -Math.PI / 2;
    pegboard.name = 'workbench-tool-wall';
    staticGroup.add(pegboard);
    box(pegboard, 2.3, 1.26, .12, m.agedWood);
    for (let x = -1; x <= 1; x += .22) for (let y = -.48; y <= .48; y += .22) {
      cylinder(pegboard, .012, .012, .03, m.darkWood, x, y, .075, 8).rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++) {
      const x = -.76 + i * .38;
      rod(pegboard, [x, .30, .15], [x + (i % 2) * .07, -.33, .15], .018, m.iron);
      sphere(pegboard, .065, m.oldBrass, x + (i % 2) * .07, -.34, .15);
    }
    label(pegboard, 'MECHANICA', 0, 1.32, .15, 1.76, .26);
  }

  function makeKey(parent, x, y, z, size = .48) {
    const shape = new THREE.Shape();
    shape.moveTo(-.10, -.04); shape.lineTo(.28, -.04); shape.lineTo(.28, -.20); shape.lineTo(.36, -.20);
    shape.lineTo(.36, -.10); shape.lineTo(.45, -.10); shape.lineTo(.45, .05); shape.lineTo(-.10, .05);
    shape.absarc(-.20, 0, .15, -Math.PI / 4, Math.PI * 1.75, false);
    const hole = new THREE.Path(); hole.absarc(-.20, 0, .067, 0, Math.PI * 2, true); shape.holes.push(hole);
    const key = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelThickness: .008, bevelSize: .007, bevelSegments: 1 }), m.brass);
    key.rotation.x = -Math.PI / 2; key.rotation.z = -.15; key.scale.setScalar(size / .48); key.position.set(x, y, z); key.castShadow = true; parent.add(key); return key;
  }

  function buildWorkbench() {
    toolPegboard();
    const work = makeTable(staticGroup, 3.25, 1.32, 7.45, 4.27, 1.0);
    work.name = 'workbench-right-of-alchemy';
    work.rotation.y = -Math.PI / 2;
    box(work, 3.35, .12, 1.39, m.ash, 0, 1.14, 0, .03);
    box(work, 1.5, .4, .09, m.darkWood, .4, .69, .59);
    for (const x of [-.45,.42]) box(work, .055, .32, .11, m.oldBrass, x, .70, .65);
    for (let i = 0; i < 2; i++) {
      box(work, .84, .21, .07, m.darkWood, -.68 + i * 1.11, .73, .626);
      cylinder(work, .044, .044, .032, m.brass, -.68 + i * 1.11, .73, .674, 12).rotation.x = Math.PI / 2;
    }
    // Vice with a brass workpiece clamped between steel jaws.
    box(work, .67, .28, .49, m.iron, -1.03, 1.31, -.29, .035);
    box(work, .12, .36, .61, m.blackMetal, -1.36, 1.47, -.30);
    box(work, .12, .36, .61, m.blackMetal, -.73, 1.47, -.30);
    rod(work, [-1.38, 1.30, -.30], [-.62, 1.30, -.30], .05, m.oldBrass);
    rod(work, [-1.48, 1.29, -.55], [-1.48, 1.29, -.03], .026, m.iron);
    box(work, .45, .08, .13, m.brass, -1.04, 1.53, -.24);
    makeKey(work, -.1, 1.22, -.29, .75);
    makeKey(work, .33, 1.22, -.12, .64);
    // Several files, a divider and a partly assembled lock.
    for (let i = 0; i < 3; i++) rod(work, [.24 + i * .14, 1.21, .27], [.46 + i * .14, 1.21, -.34], .021, i === 2 ? m.brass : m.iron);
    cylinder(work, .26, .26, .18, m.iron, 1.14, 1.29, -.20, 24).rotation.z = Math.PI / 2;
    cylinder(work, .13, .13, .21, m.brass, 1.15, 1.32, -.20, 24).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      box(work, .13, .13, .12, m.iron, 1.14 + Math.cos(a) * .29, 1.29 + Math.sin(a) * .29, -.20);
    }
    bottle(work, 1.40, 1.39, .35, m.liquidAmber, .31, .13);
    station('workbench', [7.17, 1.58, 4.27], [2.25, 2.9, 3.65]);
  }

  function flask(parent, x, y, z, liquid, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); parent.add(group);
    const pts = [new THREE.Vector2(0,0),new THREE.Vector2(.30,.02),new THREE.Vector2(.36,.14),new THREE.Vector2(.35,.37),new THREE.Vector2(.25,.55),new THREE.Vector2(.12,.65),new THREE.Vector2(.11,.95),new THREE.Vector2(.16,1.01)];
    const outer = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), m.glassBlue); outer.castShadow = true; group.add(outer);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(.30, .31, .25, 20), liquid);
    fill.position.y = .24; fill.castShadow = false; group.add(fill);
    cylinder(group, .15, .16, .055, m.oldBrass, 0, 1.02, 0, 18);
    return group;
  }

  function buildAlchemy() {
    // The entire laboratory is turned 90 degrees. Its FRONT faces the room,
    // with its back and tabletop against the fully sage-tiled RIGHT wall.
    const alcove = new THREE.Group();
    alcove.position.set(6.50, 0, -2.10);
    alcove.rotation.y = -Math.PI / 2;
    staticGroup.add(alcove);

    const counter = makeTable(alcove, 4.75, 1.74, 0, -.86, .97);
    counter.name = 'alchemy-facing-wall-table';
    box(counter, 4.81, .14, 1.78, m.walnut, 0, 1.13, 0, .024);
    // The lower, forward tier holds seven labelled metal reagents.
    box(counter, 4.83, .19, .67, m.walnut, 0, .76, 1.12, .023);
    box(counter, 4.88, .07, .13, m.oldBrass, 0, .68, 1.49);
    for (const xx of [-2.06, 2.06]) box(counter, .16, .70, .16, m.darkWood, xx, .42, 1.27);

    const reagentLabels = ['aurum', 'argentum', 'ferrum', 'cuprum', 'stannum', 'plumbum', 'hydrargyrum'];
    const fluids = [m.liquidAmber, m.slate, m.green, m.ruby, m.liquidBlue, m.paperDark, m.liquidGreen];
    const metalLabels = new THREE.TextureLoader();
    for (let i = 0; i < 7; i++) {
      const vial = new THREE.Group(); vial.position.set(-1.91 + i * .635, .88, 1.11); counter.add(vial);
      cylinder(vial, .195, .20, .055, m.oldBrass, 0, .035, 0, 16);
      cylinder(vial, .170, .176, .48, m.glassBlue, 0, .30, 0, 18);
      cylinder(vial, .148, .15, .23, fluids[i], 0, .19, 0, 16).castShadow = false;
      cylinder(vial, .087, .107, .105, m.agedWood, 0, .59, 0, 12);
      const labelTex = metalLabels.load(`/assets/label-${reagentLabels[i]}.png`);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      const tag = plane(vial, .266, .24,
        new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
        0, .29, .178);
      tag.castShadow = false;
    }

    // The raised sample rack and its four coloured pigments match the laboratory.
    const rack = new THREE.Group(); rack.position.set(0, 0, -.27); counter.add(rack);
    box(rack, 1.68, .16, .54, m.walnut, 0, 1.28, 0);
    for (const xx of [-.75, .75]) {
      box(rack, .10, .94, .10, m.darkWood, xx, 1.72, 0);
      cylinder(rack, .070, .070, .060, m.oldBrass, xx, 2.20, 0, 12);
    }
    box(rack, 1.78, .14, .55, m.walnut, 0, 2.16, -.03);
    const pigments = [m.ruby, m.liquidBlue, m.liquidAmber, m.paper];
    for (let i = 0; i < 4; i++) {
      const xx = -.55 + i * .37;
      cylinder(rack, .114, .114, .65, m.glassBlue, xx, 1.78, 0, 12);
      cylinder(rack, .100, .10, .59, pigments[i], xx, 1.74, 0, 12).castShadow = false;
      cylinder(rack, .124, .124, .042, m.oldBrass, xx, 2.20, 0, 12);
    }

    const makeGlassStand = (x, height) => {
      const g = new THREE.Group(); g.position.set(x, 0, -.38); counter.add(g);
      cylinder(g, .30, .32, .05, m.iron, 0, 1.20, 0, 22);
      for (const side of [-1, 1]) rod(g, [side * .205, 1.22, 0], [side * .205, 1.20 + height, 0], .022, m.oldBrass);
      for (const y of [1.34, 1.65, 1.94].filter(y => y < 1.17 + height)) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.215, .013, 7, 30), m.oldBrass);
        ring.rotation.x = Math.PI / 2; ring.position.set(0, y, 0); g.add(ring);
      }
      cylinder(g, .158, .166, height * .66, m.glassBlue, 0, 1.22 + height * .34, 0, 18).castShadow = false;
      cylinder(g, .16, .16, .024, m.oldBrass, 0, 1.23 + height, 0, 18);
    };
    makeGlassStand(-1.58, .96);
    makeGlassStand(1.62, 1.42);
    // Mortar, pestle, stoppered jars and a little working burner.
    cylinder(counter, .22, .24, .15, m.darkWood, -1.03, 1.26, -.14, 20);
    sphere(counter, .18, m.charcoal, -1.03, 1.34, -.14).scale.y = .12;
    rod(counter, [-1.03, 1.33, -.15], [-.70, 1.64, -.28], .052, m.ash);
    bottle(counter, 1.25, 1.34, .16, m.liquidGreen, .25, .082);
    bottle(counter, 1.56, 1.34, .18, m.liquidAmber, .23, .079);
    const mixingFlask = flask(counter, .65, 1.23, .02, m.liquidBlue, .47);
    const flameMat = new THREE.MeshBasicMaterial({ color: '#90dce2', transparent: true, opacity: .74, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.095, .25, 12), flameMat);
    flame.position.set(.65, 1.25, .02); counter.add(flame);
    animated.push(t => {
      flame.scale.set(.9 + Math.sin(t * 7) * .1, 1 + Math.sin(t * 9) * .14, .9);
      mixingFlask.rotation.z = Math.sin(t * .65) * .006;
    });
    candle(counter, -2.12, 1.19, -.35);
    candle(counter, 2.12, 1.19, -.35);

    // Deep shelf, parchment recipe, antique clock and small jars on tile.
    box(alcove, 5.38, .14, .39, m.walnut, 0, 3.25, -1.52);
    for (const xx of [-2.2, 2.2]) box(alcove, .12, .35, .23, m.darkWood, xx, 3.02, -1.61);
    for (const xx of [-2.40, -1.94, -1.47, 1.45, 1.91, 2.38]) {
      cylinder(alcove, .10, .105, .29, m.glassBlue, xx, 3.45, -1.56, 14).castShadow = false;
      cylinder(alcove, .085, .087, .14, m.liquidGreen, xx, 3.38, -1.56, 14).castShadow = false;
      cylinder(alcove, .11, .10, .05, m.agedWood, xx, 3.62, -1.56, 12);
    }
    const recipe = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#bcad86'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#514b36'; ctx.lineWidth = 19; ctx.strokeRect(24, 24, w - 48, h - 48);
      ctx.strokeStyle = 'rgba(70,61,43,.52)'; ctx.lineWidth = 3; ctx.strokeRect(47, 49, w - 94, h - 100);
      ctx.fillStyle = '#393a30'; ctx.textAlign = 'center';
      ctx.font = '32px Georgia'; ctx.fillText('ALCHEMIA · VII', w / 2, 123);
      ctx.font = 'bold 56px Georgia'; ctx.fillText('РЕЦЕПТ ЗЕЛЬЯ', w / 2, 202);
      ctx.font = '29px Georgia'; ctx.fillText('ЛИСТЪ № 183 · НАСТОЙКА', w / 2, 255);
      ctx.font = 'bold 123px Georgia'; ctx.fillText('2● + 3♄ + 2△', w / 2, 417);
      ctx.font = '29px Georgia'; ctx.fillText('НИКТО НЕ ЗНАЕТЪ СЕКРЕТА', w / 2, 576);
    }, 1024, 650);
    const recipeFrame = new THREE.Group(); recipeFrame.position.set(-.34, 4.46, -1.67); alcove.add(recipeFrame);
    box(recipeFrame, 1.94, 1.44, .09, m.darkWood);
    plane(recipeFrame, 1.77, 1.28, new THREE.MeshStandardMaterial({ map: recipe, roughness: 1 }), 0, 0, .065);
    const clockBox = new THREE.Group(); clockBox.position.set(1.48, 4.37, -1.64); alcove.add(clockBox);
    box(clockBox, .64, .78, .12, m.darkWood);
    box(clockBox, .54, .66, .025, m.oldBrass, 0, 0, .079);
    const dial = canvasTexture((ctx,w,h) => {
      ctx.fillStyle = '#d0c7a5'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = '#3c483d'; ctx.lineWidth = 27; ctx.beginPath(); ctx.arc(w/2,h/2,420,0,Math.PI*2); ctx.stroke();
      for(let i=0;i<12;i++) {const a=i*Math.PI/6; const r0=i%3===0?305:348; ctx.lineWidth=i%3===0?14:7;
        ctx.beginPath();ctx.moveTo(512+Math.sin(a)*r0,512-Math.cos(a)*r0);ctx.lineTo(512+Math.sin(a)*390,512-Math.cos(a)*390);ctx.stroke();}
      ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(512,512);ctx.lineTo(512,250);ctx.stroke();
      ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(512,512);ctx.lineTo(695,535);ctx.stroke();
      ctx.fillStyle='#36443c';ctx.beginPath();ctx.arc(512,512,27,0,Math.PI*2);ctx.fill();
    });
    plane(clockBox, .48, .54, new THREE.MeshBasicMaterial({ map: dial }), 0, 0, .098);
    station('alchemy', [6.86, 2.34, -2.10], [3.05, 5.8, 5.22]);
  }

  function buildGramophone() {
    const chest = makeTable(staticGroup, 1.37, .76, 1.97, -3.67, 1.17);
    chest.name = 'gramophone-table';
    box(chest, 1.43, .12, .78, m.ash, 0, 1.29, 0, .025);
    box(chest, 1.26, .55, .54, m.darkWood, 0, .81, -.02, .03);
    box(chest, 1.12, .36, .05, m.walnut, 0, .83, .29);
    cylinder(chest, .038, .038, .04, m.oldBrass, 0, .82, .33, 14).rotation.x = Math.PI / 2;
    const gram = new THREE.Group(); gram.position.set(0, 1.37, 0); chest.add(gram);
    box(gram, .95, .23, .67, m.darkWood, 0, .11, 0, .04);
    const vinyl = cylinder(gram, .34, .34, .018, m.charcoal, -.18, .23, .01, 36);
    cylinder(gram, .06, .06, .021, m.oldBrass, -.18, .244, .01, 20);
    rod(gram, [.22, .22, .23], [.02, .30, .01], .021, m.oldBrass);
    rod(gram, [.01, .30, .01], [-.05, .29, -.02], .015, m.oldBrass);
    const horn = new THREE.Group(); horn.position.set(.37, .24, -.16); gram.add(horn);
    rod(horn, [0,0,0], [0,.65,0], .052, m.oldBrass);
    const pts = [new THREE.Vector2(.06,0),new THREE.Vector2(.08,.2),new THREE.Vector2(.13,.38),new THREE.Vector2(.27,.54),new THREE.Vector2(.47,.72),new THREE.Vector2(.54,.77)];
    const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: '#ba9050', metalness: .59, roughness: .38, side: THREE.DoubleSide }));
    bell.position.y = .44; bell.rotation.z = -.45; bell.castShadow = true; horn.add(bell);
    cylinder(horn, .54, .54, .018, m.oldBrass, -.31, 1.13, 0, 32).rotation.z = -.45;
    animated.push(t => { vinyl.rotation.y = t * .12; });
    station('gramophone', [1.97, 2.42, -3.68], [1.58, 2.65, 1.12]);
  }

  function buildDetails() {
    // Keep the tall window wall free from pictures and the former upper gallery.
    // Column lamps create pools of warm light around the room.
    for (const x of [-7.98, 7.98]) {
      const lamp = new THREE.Group(); lamp.position.set(x, 3.10, -1.10); staticGroup.add(lamp);
      box(lamp, .14, .65, .22, m.oldBrass);
      sphere(lamp, .22, new THREE.MeshBasicMaterial({ color: '#f0c591', transparent: true, opacity: .65 }), 0, 0, .19);
      const light = new THREE.PointLight('#ffc183', 3.5, 5.5, 2); light.position.set(0, 0, .35); lamp.add(light);
    }
    ambientParticles = createAmbientParticles(staticGroup);
    animated.push(t => ambientParticles.update(t));
  }

  buildShell(); buildWindow(); buildRestoration(); buildPlanning(); buildWorkbench(); buildAlchemy(); buildGramophone(); buildDetails();
  const wallpapers = {
    tile: m.alchemyTile,
    ochre: m.restorationWall,
    botanical: m.wallpaperBotanical,
    damask: m.wallpaperDamask,
  };
  return {
    anchors, hitTargets, animated, ambientParticles,
    setRightWallpaper(name) {
      if (!Object.hasOwn(wallpapers, name) || !rightWallFinish) return false;
      rightWallFinish.material = wallpapers[name];
      return true;
    },
  };
}
