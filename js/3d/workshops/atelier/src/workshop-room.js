// @ts-check
import { createFrameGeometry } from './frame-geometry.js';
import { createDust } from '../../../core/rendering/dust.js';

/** Builds the static atelier and exposes its easel factory and wood surfaces. */
// includeShelf: the wall shelf with pigment jars (the standalone Atelier; the Lair has none).
export function createWorkshopRoom({ THREE, scene, mats, includeWallTrim = true, includeShelf = true, includeDust = true, wallZ = -4.6, floorY = -.0285 }) {
  const floorWoodMaterials = [];
  // Static furniture repeats the same primitives dozens of times. Reuse their
  // immutable GPU buffers across both easels, planks, shelves and tools.
  const boxGeometries = new Map();
  const cylinderGeometries = new Map();
  let wallpaperMaterial;

  function geometry(cache, key, create) {
    if (!cache.has(key)) cache.set(key, create());
    return cache.get(key);
  }

  function boxGeometry(w, h, d) {
    return geometry(boxGeometries, `${w}/${h}/${d}`, () => new THREE.BoxGeometry(w, h, d));
  }

  function cylinderGeometry(rTop, rBottom, h, segments) {
    return geometry(cylinderGeometries, `${rTop}/${rBottom}/${h}/${segments}`,
      () => new THREE.CylinderGeometry(rTop, rBottom, h, segments));
  }

  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function rod(from, to, radius, material, parent, segments = 8) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(cylinderGeometry(radius * .91, radius, dir.length(), segments), material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(rTop, rBottom, h, material, x, y, z, parent = scene, segments = 14) {
    const mesh = new THREE.Mesh(cylinderGeometry(rTop, rBottom, h, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function prepareRoom() {
    scene.add(new THREE.HemisphereLight('#ffe9c3', '#514536', 1.95));
    const ambient = new THREE.AmbientLight('#efd9b7', 0.42);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ffe0a5', 3.65);
    sun.position.set(3.6, 7.5, 6.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = .5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -17;
    sun.shadow.camera.right = 17;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -.00015;
    sun.shadow.normalBias = .025;
    scene.add(sun);
    const fill = new THREE.PointLight('#ffcf96', 55, 14, 2);
    fill.position.set(-4, 3.4, 4.5);
    scene.add(fill);

    // One continuous hand-painted gouache sheet, mapped once across the entire wall.
    wallpaperMaterial = new THREE.MeshStandardMaterial({ color: '#bdac98', roughness: 1 });
    // The gallery rises well above the easels; its top is deliberately out of
    // frame in the normal workshop view and revealed by the traveling camera.
    const wall = box(32, 14.21, .2, wallpaperMaterial, 0, 5.555, -4.7);
    wall.name = 'atelier-original-wallpaper';
    wall.castShadow = false;
    // Mask fixed room architecture out of the normal/ink pass. Distance-based
    // fading alone fails when the camera zooms into the gallery wall.
    wall.userData.excludeFromInk = true;
    if (includeWallTrim) {
      const noInk = (mesh) => { mesh.userData.excludeFromInk = true; return mesh; };
      noInk(box(32, .12, .18, mats.roomWood, 0, 12.35, -4.47));
      noInk(box(32, .26, .31, mats.roomWood, 0, 1.24, -4.48));
      noInk(box(32, 1.22, .15, new THREE.MeshStandardMaterial({ color: '#69513e', roughness: .92 }), 0, .58, -4.53));
      for (let i = -13; i <= 13; i++) noInk(box(.033, 1.16, .03, mats.roomWood, i * 1.12, .59, -4.43));
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 35), new THREE.MeshStandardMaterial({ color: '#57412f', roughness: .95 }));
    floor.name = 'atelier-original-floor-base';
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.08;
    floor.receiveShadow = true;
    floor.userData.excludeFromInk = true;
    scene.add(floor);
    const floorColors = ['#f0e3d1', '#d7cab9', '#e7dac7', '#c8b7a3', '#ead2b5'];
    // Five tones, reused on 38 distinct planks; one shared wood texture below.
    floorWoodMaterials.push(...floorColors.map((color) =>
      new THREE.MeshStandardMaterial({ color, roughness: .91 })));
    for (let r = 0; r < 38; r++) {
      const z = -6.1 + r * .38;
      const material = floorWoodMaterials[r % floorWoodMaterials.length];
      const plank = box(32, .035, .372, material, 0, -.046, z);
      plank.name = `atelier-original-floor-plank-${r}`;
      plank.castShadow = false;
      plank.userData.excludeFromInk = true;
    }
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 3.5), new THREE.MeshStandardMaterial({ color: '#796044', roughness: 1, transparent: true, opacity: .4, depthWrite: false }));
    rug.name = 'atelier-original-floor-rug';
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, -.02, .35);
    rug.receiveShadow = true;
    rug.userData.excludeFromInk = true;
    scene.add(rug);

    // The entire rear wall is kept clear for optional hanging artworks.

    const colors = ['#9a5342', '#b68d52', '#6a8477', '#b6a48c', '#4f6570', '#bd8557', '#6b4934', '#7c7763'];
    if (includeShelf) {
      // Tool shelving and glass pigment jars.
      const shelfZ = wallZ + .285;
      for (const y of [1.45, 2.45, 3.45]) {
        box(2.15, .105, .58, mats.roomWood, -5.25, y, shelfZ).name = 'restoration-wall-shelf';
        box(.08, .52, .50, mats.roomEdge, -6.1, y - .309, wallZ + .24);
        box(.08, .52, .50, mats.roomEdge, -4.45, y - .309, wallZ + .24);
      }
      // No transmission: in the Lair it makes Three.js draw every opaque object
      // once more per frame, for eight small jars.
      const jarGlass = new THREE.MeshPhysicalMaterial({ color: '#d9d3bd', roughness: .18,
        transparent: true, opacity: .65 });
      for (let i = 0; i < 8; i++) {
        const row = Math.floor(i / 4), col = i % 4;
        const x = -6 + col * .5, baseY = 1.5025 + row, z = shelfZ + .025;
        cylinder(.12, .13, .37, jarGlass, x, baseY + .185, z);
        const pigment = cylinder(.103, .103, .23, new THREE.MeshStandardMaterial({ color: colors[i], roughness: .91 }), x, baseY + .13, z);
        pigment.userData.excludeFromInk = true;
        pigment.castShadow = false;
        cylinder(.125, .125, .075, mats.roomWood, x, baseY + .40, z);
      }
    }

    // Work table, scattered brushes, palette and restoration paraphernalia.
    const tabletopY = .91 + .13 / 2;
    const tableFrame = new THREE.Group();
    tableFrame.name = 'restoration-worktable';
    scene.add(tableFrame);
    const worktable = box(2.75, .13, 1.15, mats.roomWood, 5.17, .91, 1.0, tableFrame);
    worktable.name = 'restoration-worktable-top';
    const legBottom = floorY - .003, legTop = .848;
    for (const x of [4.07, 6.21]) for (const z of [.59, 1.43]) {
      box(.11, legTop - legBottom, .11, mats.roomEdge, x, (legTop + legBottom) / 2, z, tableFrame);
    }
    const brushPad = box(1.1, .06, .72, mats.linen, 5.13, tabletopY + .03, 1.03);
    brushPad.name = 'restoration-brush-pad';
    const brushPadY = tabletopY + .06;
    for (let i = 0; i < 7; i++) {
      const x = 4.63 + i * .15;
      const handle = rod([x, brushPadY + .016, .77], [x + .10, brushPadY + .016, 1.21],
        .016, mats.roomWood, scene, 8);
      handle.name = `restoration-brush-${i + 1}-handle`;
      const ferrule = rod([x + .10, brushPadY + .011, 1.21],
        [x + .12, brushPadY + .011, 1.33], .011, mats.metal, scene, 8);
      ferrule.name = `restoration-brush-${i + 1}-ferrule`;
    }
    const palette = new THREE.Group();
    palette.name = 'restoration-palette';
    // Extruded bevel extends .012 below the local plane; rest it on the tabletop.
    palette.position.set(6, tabletopY + .012, 1.08);
    const paletteShape = new THREE.Shape();
    paletteShape.absellipse(0, 0, .42, .3, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(.23, -.07, .075, .07, 0, Math.PI * 2, true, 0);
    paletteShape.holes.push(hole);
    const paletteMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(paletteShape, { depth: .028, bevelEnabled: true, bevelSize: .015, bevelThickness: .012, bevelSegments: 2 }), mats.roomWood);
    paletteMesh.rotation.x = -Math.PI / 2;
    palette.add(paletteMesh);
    scene.add(palette);
    const paintDotGeometry = new THREE.SphereGeometry(.048, 9, 6);
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(paintDotGeometry, new THREE.MeshStandardMaterial({ color: colors[i], roughness: 1 }));
      dot.scale.y = .24;
      dot.position.set(5.78 + .1 * (i % 3), tabletopY + .04 + .048 * .24,
        .95 + .11 * Math.floor(i / 3));
      scene.add(dot);
    }

    // Restored frames are stacked against the right wall with their painted
    // faces turned away. Linen backs and stretcher bars face the viewer.
    const canvasBack = new THREE.MeshStandardMaterial({ color: '#b9aa91', roughness: 1 });
    const stackedCanvases = [
      { x: 5.02, z: -4.23, width: 1.06, height: 1.47, lean: -.35, yaw: -.09, roll: .10 },
      { x: 4.48, z: -4.20, width: 1.20, height: 1.78, lean: -.31, yaw: .04, roll: -.07 },
      { x: 5.14, z: -4.09, width: 1.27, height: 1.91, lean: -.29, yaw: -.05, roll: .065 },
      { x: 4.66, z: -3.92, width: 1.02, height: 1.54, lean: -.35, yaw: .075, roll: -.045 },
    ];
    for (const [index, item] of stackedCanvases.entries()) {
      const { x, z, width, height, lean, yaw, roll } = item;
      const canvas = new THREE.Group();
      canvas.name = `leaning-canvas-back-${index + 1}`;
      canvas.position.set(x, 0, z);
      canvas.rotation.set(lean, yaw, roll);
      box(width, height, .045, canvasBack, 0, 0, .033, canvas);
      const edge = new THREE.Mesh(createFrameGeometry(THREE, width, height, .075, .068), mats.frameWood);
      edge.position.z = .015;
      edge.castShadow = true;
      edge.receiveShadow = true;
      canvas.add(edge);
      for (const y of [-height * .35, height * .35]) box(width * .79, .075, .052, mats.easelEdge, 0, y, .101, canvas);
      for (const railX of [-width * .35, width * .35]) box(.075, height * .74, .052, mats.easelEdge, railX, 0, .101, canvas);
      box(.06, height * .62, .055, mats.easel, 0, 0, .143, canvas);
      const canvasBounds = new THREE.Box3().setFromObject(canvas, true);
      canvas.position.y += floorY - canvasBounds.min.y - .002;
      canvas.position.z += wallZ - canvasBounds.min.z - .003;
      scene.add(canvas);
    }

    // The game's one dust (core/rendering/dust.js); in the Lair the room's
    // dust fills this corner, so the Atelier adds none there.
    return includeDust
      ? createDust(scene, { min: [-6, .35, -1.4], max: [6, 4.75, 4.6], count: 95, seed: 122, scale: .7, opacity: .42 })
      : null;
  }

  function makeEasel(x, facing) {
    const root = new THREE.Group();
    root.position.set(x, 0, 0);
    root.rotation.y = facing;
    scene.add(root);

    // Taller support legs leave 60% more space below the painting shelf.
    rod([-.72, -.035, .33], [-.073, 3.78, -.08], .076, mats.easel, root);
    rod([ .72, -.035, .33], [ .073, 3.78, -.08], .076, mats.easel, root);
    rod([0, -.035, -1.04], [0, 3.10, -.24], .059, mats.easel, root);
    for (const x of [-.72, .72]) box(.21, .07, .35, mats.easel, x, -.003, .33, root);
    box(.23, .07, .37, mats.easel, 0, -.003, -1.04, root);
    rod([-.61, .54, .265], [.61, .54, .265], .034, mats.easelEdge, root);
    // Single central shaft and a flush head. The former stacked caps had
    // near-coplanar wood faces that produced flickering at shallow angles.
    box(.125, 2.87, .13, mats.easel, 0, 2.355, -.155, root);
    box(.24, .14, .20, mats.easel, 0, 3.81, -.115, root);
    box(1.03, .13, .17, mats.deepWood, 0, 1.23, -.15, root);
    // The frame front lies at z=.42. The former clamp ended at exactly
    // z=.42 too, making the two front faces fight for the same pixels.
    const topClamp = box(.30, .12, .18, mats.deepWood, 0, 3.17, .46, root);
    topClamp.receiveShadow = false;

    const shelf = new THREE.Group();
    box(2.47, .11, .27, mats.easelEdge, 0, 0, .23, shelf);
    box(2.47, .075, .065, mats.deepWood, 0, .072, .356, shelf);
    shelf.scale.x = .76;
    root.add(shelf);

    const artwork = new THREE.Group();
    artwork.position.z = .24;
    root.add(artwork);
    return { root, artwork, shelf, topClamp };
  }

  const dust = prepareRoom();
  return { dust, makeEasel, wallpaperMaterial, floorWoodMaterials };
}
