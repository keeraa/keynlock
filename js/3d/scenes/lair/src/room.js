import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCityWindowTexture, makeMapTexture } from './materials.js';

/** A single continuous room, using the proportions and gouache materials of the existing ateliers. */
export function buildLair(scene, m) {
  const anchors = {};
  const hitTargets = [];
  const animated = [];
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const shadow = mesh => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
  const box = (parent, w, h, d, material, x = 0, y = 0, z = 0, bevel = 0) => {
    const geometry = bevel ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d);
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
    const mesh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(radius * .92, radius, direction.length(), sides), material));
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
      ctx.fillStyle = '#382d20'; ctx.font = 'bold 88px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2);
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
    scene.fog = new THREE.Fog('#514d40', 22, 43);
    const floorBase = box(staticGroup, 17.3, .22, 13.8, m.darkWood, 0, -.14, .4);
    floorBase.castShadow = false;
    for (let i = 0; i < 38; i++) {
      const z = -5.64 + i * .325;
      const plank = box(staticGroup, 17.1, .047, .312, i % 6 === 0 ? m.floorAlternate : m.floor, 0, .015, z);
      plank.castShadow = false;
      if (i % 5 === 0) box(staticGroup, 17.1, .006, .009, m.darkWood, 0, .045, z - .155).castShadow = false;
    }
    box(staticGroup, 17.4, 6.9, .27, m.plaster, 0, 3.31, -5.62).castShadow = false;
    box(staticGroup, .27, 6.9, 13.0, m.plaster, -8.55, 3.31, .75).castShadow = false;
    box(staticGroup, .27, 6.9, 13.0, m.plaster, 8.55, 3.31, .75).castShadow = false;
    box(staticGroup, 17.5, .2, 13.5, m.darkWood, 0, 6.71, .65).castShadow = false;

    // Wainscot panels, framed with dark timber; the left wall is kept free for the restoration easel.
    box(staticGroup, 17.25, 1.65, .08, m.agedWood, 0, .9, -5.39);
    box(staticGroup, 17.25, .12, .17, m.darkWood, 0, 1.76, -5.28);
    box(staticGroup, 17.25, .2, .23, m.walnut, 0, .18, -5.26);
    for (let i = -7; i <= 7; i++) {
      box(staticGroup, .09, 1.45, .09, m.darkWood, i * 1.18, .93, -5.31);
      if (i < 7) box(staticGroup, .92, .04, .045, m.oldBrass, i * 1.18 + .59, 1.49, -5.23);
    }
    for (const side of [-1, 1]) {
      box(staticGroup, .08, 1.66, 12.9, m.agedWood, side * 8.35, .88, .75);
      box(staticGroup, .19, .15, 12.9, m.darkWood, side * 8.23, 1.77, .75);
      box(staticGroup, .22, .2, 12.9, m.walnut, side * 8.2, .17, .75);
    }
    for (const x of [-8.25, -4.25, 0, 4.25, 8.25]) {
      box(staticGroup, .31, 6.6, .32, m.darkWood, x, 3.29, -5.32);
      box(staticGroup, .45, .22, .48, m.walnut, x, 5.76, -5.31);
    }
    for (const z of [-4.8, -1.7, 1.4, 4.5]) {
      box(staticGroup, 17.15, .28, .3, m.darkWood, 0, 6.5, z);
      for (const x of [-8.15, 8.15]) box(staticGroup, .42, .44, .52, m.walnut, x, 6.38, z);
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

  function framedPainting(parent, width, height, artName, x, y, z, yaw = 0) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = yaw; parent.add(group);
    box(group, width + .13, height + .13, .1, m.darkWood, 0, 0, 0);
    const art = new THREE.TextureLoader().load(`/assets/${artName}`);
    art.colorSpace = THREE.SRGBColorSpace;
    const artwork = new THREE.Mesh(new THREE.PlaneGeometry(width - .09, height - .09), new THREE.MeshStandardMaterial({ map: art, roughness: 1 }));
    artwork.position.z = .063; group.add(artwork);
    for (const side of [-1, 1]) {
      box(group, .115, height + .32, .16, m.walnut, side * (width / 2 + .05), 0, .08, .02);
      box(group, width + .32, .115, .16, m.walnut, 0, side * (height / 2 + .05), .08, .02);
      box(group, .016, height + .09, .05, m.oldBrass, side * (width / 2 - .025), 0, .17);
      box(group, width + .09, .016, .05, m.oldBrass, 0, side * (height / 2 - .025), .17);
    }
    return group;
  }

  function buildWindow() {
    box(staticGroup, 4.15, 3.65, .16, m.darkWood, -.05, 4.22, -5.21, .09);
    const outer = box(staticGroup, 3.86, 3.39, .11, m.oldBrass, -.05, 4.22, -5.11);
    outer.castShadow = false;
    const cityTex = makeCityWindowTexture();
    plane(staticGroup, 3.66, 3.19, new THREE.MeshBasicMaterial({ map: cityTex, toneMapped: false }), -.05, 4.22, -5.035);
    for (const x of [-1.90, -.05, 1.80]) box(staticGroup, .105, 3.36, .14, m.darkWood, x, 4.22, -4.96);
    for (const y of [2.56, 4.10, 5.84]) box(staticGroup, 3.89, .095, .14, m.darkWood, -.05, y, -4.96);
    for (const x of [-1.96, 1.86]) box(staticGroup, .18, 3.62, .2, m.walnut, x, 4.22, -4.90);
    box(staticGroup, 4.34, .19, .47, m.walnut, -.05, 2.34, -4.72, .035);
    // Curtains fall in loose, wide vertical folds.
    for (const sign of [-1, 1]) {
      const curtain = new THREE.Group(); curtain.position.set(sign * 1.91, 4.2, -4.68); staticGroup.add(curtain);
      for (let i = 0; i < 5; i++) {
        const strip = box(curtain, .16, 3.13 + Math.sin(i * 1.8) * .06, .09, m.slate, sign * (i * .105), 0, Math.sin(i * 2) * .08);
        strip.rotation.z = sign * .02 * i;
      }
      sphere(staticGroup, .115, m.oldBrass, sign * 1.93, 4.36, -4.52);
    }
    // Broad translucent sunlight falls across the central table.
    const beamMat = new THREE.MeshBasicMaterial({ color: '#f7d3a0', transparent: true, opacity: .036, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7.2, 4, 1, true), beamMat);
    beam.rotation.x = -.55; beam.position.set(-.25, 3.35, -2.5); staticGroup.add(beam);
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
    const root = new THREE.Group(); root.position.set(-5.48, 0, -2.65); root.rotation.y = -.18; staticGroup.add(root);
    // Tall, three-legged easel supporting a real painting from the existing restoration module.
    rod(root, [-.66, .06, .36], [-.10, 3.65, -.12], .077, m.agedWood);
    rod(root, [.66, .06, .36], [.10, 3.65, -.12], .077, m.agedWood);
    rod(root, [0, .06, -.87], [0, 3.15, -.27], .058, m.darkWood);
    box(root, .2, 3.35, .19, m.walnut, 0, 2.16, -.13);
    box(root, 1.72, .12, .41, m.darkWood, 0, 1.08, .23);
    box(root, .32, .11, .21, m.oldBrass, 0, 3.40, .36);
    framedPainting(root, 1.63, 2.06, 'girl-pearl.jpg', 0, 2.33, .36, 0);
    label(staticGroup, 'RESTAURATIO', -5.58, 4.92, -5.14, 2.1, .3);

    const table = makeTable(staticGroup, 2.65, 1.13, -6.15, .63, .91);
    box(table, 1.02, .025, .7, m.linen, -.38, 1.055, -.07);
    const pigmentColors = [m.ruby, m.green, m.slate, m.liquidAmber, m.paperDark];
    for (let i = 0; i < 5; i++) bottle(table, -.95 + i * .33, 1.23, -.30, pigmentColors[i], .30, .105);
    for (let i = 0; i < 6; i++) brush(table, -.82 + i * .18, 1.057, .27, -.1 + .08 * i);
    // Artist's palette and scattered swatches.
    const palette = cylinder(table, .31, .33, .025, m.ash, .65, 1.065, .06, 24);
    palette.scale.z = .73;
    for (let i = 0; i < 5; i++) {
      const dot = sphere(table, .045, pigmentColors[i], .47 + .12 * (i % 3), 1.088, -.01 + .12 * Math.floor(i / 3), 10);
      dot.scale.y = .23;
    }
    // Folded cloth and a magnifying glass, resting firmly on the work surface.
    box(table, .51, .05, .38, m.canvas, .05, 1.07, .13, .012);
    const lens = cylinder(table, .15, .15, .017, m.glassBlue, 1.04, 1.087, .19, 24);
    cylinder(table, .165, .165, .026, m.oldBrass, 1.04, 1.075, .19, 24);
    lens.position.y = 1.102;
    rod(table, [1.06, 1.087, .31], [1.21, 1.09, .49], .028, m.darkWood);
    // The wall shelves occupy the left edge, leaving a long expanse of empty plaster.
    for (const y of [2.24, 3.30, 4.36]) {
      box(staticGroup, 2.10, .10, .46, m.walnut, -7.18, y, -4.66, .025);
      for (const x of [-7.96, -6.41]) box(staticGroup, .07, .42, .30, m.darkWood, x, y - .24, -4.75);
    }
    for (let i = 0; i < 9; i++) bottle(staticGroup, -8.02 + (i % 3) * .41, 2.48 + Math.floor(i / 3) * 1.06, -4.51,
      pigmentColors[i % 5], .23 + (i % 2) * .08, .09);
    const stool = new THREE.Group(); stool.position.set(-7.22, 0, 2.26); staticGroup.add(stool);
    cylinder(stool, .45, .40, .14, m.ash, 0, .59, 0, 24);
    for (const x of [-.26, .26]) for (const z of [-.25, .25]) rod(stool, [x, .12, z], [x * .75, .57, z * .75], .052, m.agedWood);
    // Rolled canvas tubes along the skirting board.
    for (let i = 0; i < 3; i++) {
      const roll = cylinder(staticGroup, .105, .105, 1.7 + .35 * i, m.canvas, -7.75 + i * .30, 1.02 + i * .15, -3.82 + i * .16, 16);
      roll.rotation.z = -.17 - i * .10;
    }
    station('restoration', [-5.48, 2.20, -2.35], [3.75, 4.9, 3.25]);
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
    // Compact planning board to the right of the central window.
    const board = new THREE.Group(); board.position.set(3.23, 3.37, -5.17); staticGroup.add(board);
    box(board, 2.27, 1.75, .10, m.darkWood);
    const map = makeMapTexture();
    plane(board, 2.05, 1.50, new THREE.MeshStandardMaterial({ map, roughness: 1 }), 0, 0, .072);
    for (const [x, y] of [[-.56,.42],[.48,-.25],[-.12,-.35]]) {
      sphere(board, .064, m.ruby, x, y, .12, 9);
      cylinder(board, .022, .027, .095, m.oldBrass, x, y, .12, 10).rotation.x = Math.PI / 2;
    }
    const shelf = box(staticGroup, 1.9, .12, .52, m.walnut, 2.84, 1.98, -4.96);
    shelf.castShadow = false;
    for (let i = 0; i < 5; i++) box(staticGroup, .15 + i * .022, .54 + (i % 2) * .16, .3, i % 2 ? m.ruby : m.leather, 2.1 + i * .24, 2.32 + (i % 2) * .08, -4.90);
    station('planning', [0, 1.42, 1.28], [3.4, 2.8, 2.6]);
  }

  function toolPegboard() {
    const pegboard = new THREE.Group(); pegboard.position.set(5.29, 3.22, -5.16); staticGroup.add(pegboard);
    box(pegboard, 2.3, 1.26, .12, m.agedWood);
    for (let x = -1; x <= 1; x += .22) for (let y = -.48; y <= .48; y += .22) {
      cylinder(pegboard, .012, .012, .03, m.darkWood, x, y, .075, 8).rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++) {
      const x = -.76 + i * .38;
      rod(pegboard, [x, .30, .15], [x + (i % 2) * .07, -.33, .15], .018, m.iron);
      sphere(pegboard, .065, m.oldBrass, x + (i % 2) * .07, -.34, .15);
    }
    label(staticGroup, 'MECHANICA', 5.35, 4.54, -5.10, 1.76, .26);
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
    const work = makeTable(staticGroup, 3.25, 1.32, 4.30, .28, 1.0);
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
    station('workbench', [4.24, 1.58, .13], [3.55, 2.9, 2.2]);
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
    // A complete but compact alcove: glass, still, burners, tile and wooden racks.
    const alcove = new THREE.Group(); alcove.position.set(6.85, 0, -3.15); staticGroup.add(alcove);
    const tile = new THREE.MeshStandardMaterial({ color: '#879086', roughness: .99 });
    for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) {
      const t = box(alcove, .36, .35, .045, (r + c) % 4 === 0 ? m.ash : tile, -1.28 + c * .37, 2.10 + r * .36, -2.29);
      t.castShadow = false;
    }
    const counter = makeTable(alcove, 2.27, 1.05, -.34, .02, .96);
    box(counter, 2.34, .08, 1.12, m.ash, 0, 1.10, 0, .025);
    for (const y of [2.5, 3.95]) {
      box(alcove, 2.40, .12, .51, m.walnut, -.37, y, -1.96);
      for (const x of [-1.43,.73]) box(alcove, .09, .38, .39, m.darkWood, x, y - .20, -1.98);
    }
    for (let i = 0; i < 10; i++) bottle(alcove, -1.36 + (i % 5) * .46, 2.75 + Math.floor(i / 5) * 1.46, -1.96,
      [m.liquidGreen,m.liquidAmber,m.liquidBlue,m.ruby,m.paperDark][i % 5], .28 + (i % 3) * .06, .10);
    const mainFlask = flask(counter, -.56, 1.18, -.15, m.liquidGreen, .72);
    const smallFlask = flask(counter, .38, 1.16, .12, m.liquidAmber, .49);
    const stand = new THREE.Group(); stand.position.set(.46, 0, -.28); counter.add(stand);
    cylinder(stand, .31, .31, .04, m.iron, 0, 1.20, 0);
    rod(stand, [0, 1.20, 0], [0, 2.27, 0], .035, m.iron);
    rod(stand, [0, 2.05, 0], [-.85, 2.05, 0], .024, m.iron);
    cylinder(stand, .13, .13, .035, m.brass, -.83, 2.05, 0).rotation.z = Math.PI / 2;
    // A warm blue flame beneath the flask.
    const flameMat = new THREE.MeshBasicMaterial({ color: '#88c9ce', transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.11, .28, 12), flameMat);
    flame.position.set(-.56, 1.23, -.15); counter.add(flame);
    animated.push(t => { flame.scale.set(.86 + Math.sin(t * 7) * .10, .9 + Math.sin(t * 10) * .15, .9); mainFlask.rotation.z = Math.sin(t * .6) * .006; smallFlask.rotation.z = Math.sin(t * .8) * .008; });
    label(staticGroup, 'ALCHEMIA', 6.46, 5.27, -5.11, 1.82, .28);
    station('alchemy', [6.36, 2.26, -3.35], [2.95, 4.55, 2.60]);
  }

  function buildGramophone() {
    const chest = makeTable(staticGroup, 1.37, .76, 1.97, -3.67, 1.17);
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
    // Small old painting on the wall, collected trophies and carefully spaced frames.
    framedPainting(staticGroup, 1.20, .85, 'great-wave.jpg', -2.75, 4.22, -5.09);
    framedPainting(staticGroup, 1.03, .86, 'starry-night.jpg', 7.69, 4.45, -5.12);
    // Column lamps create pools of warm light around the room.
    for (const x of [-7.98, 7.98]) {
      const lamp = new THREE.Group(); lamp.position.set(x, 3.10, -1.10); staticGroup.add(lamp);
      box(lamp, .14, .65, .22, m.oldBrass);
      sphere(lamp, .22, new THREE.MeshBasicMaterial({ color: '#f0c591', transparent: true, opacity: .65 }), 0, 0, .19);
      const light = new THREE.PointLight('#ffc183', 3.5, 5.5, 2); light.position.set(0, 0, .35); lamp.add(light);
    }
    // Real dust motes drift through the sunlight.
    let seed = 42; const rng = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const count = 185, positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { positions[i * 3] = (rng() - .5) * 15; positions[i * 3 + 1] = rng() * 5.6 + .35; positions[i * 3 + 2] = rng() * 10 - 4.9; }
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(geom, new THREE.PointsMaterial({ color: '#ffe8bc', size: .019, transparent: true, opacity: .42, depthWrite: false }));
    staticGroup.add(dust);
    animated.push(t => { dust.rotation.y = Math.sin(t * .075) * .004; const att = geom.getAttribute('position'); for (let i = 1; i < att.count * 3; i += 3) { att.array[i] += .0005; if (att.array[i] > 6.2) att.array[i] = .2; } att.needsUpdate = true; });
  }

  buildShell(); buildWindow(); buildRestoration(); buildPlanning(); buildWorkbench(); buildAlchemy(); buildGramophone(); buildDetails();
  return { anchors, hitTargets, animated };
}
