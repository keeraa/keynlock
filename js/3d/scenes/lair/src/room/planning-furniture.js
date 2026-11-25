import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ROOM_FLOOR_Y, ROOM_WALL_X, ROOM_WINDOW_WALL_Z } from '../room-layout.js';

const rightSofaZ = ROOM_WINDOW_WALL_Z + 1.685;
const leftSofaZ = ROOM_WINDOW_WALL_Z + 1.755;
const sofaOffset = ROOM_WALL_X - 1.60;
const rightSofaScale = 1.23 * 1.6;
const rightSofaWidth = 1.571468 * rightSofaScale;
const coffeeTableDimensions = { scale: 1.3 * 1.2 * 1.5, height: .65 };
const vaseTableDimensions = { ...coffeeTableDimensions, height: 2 * coffeeTableDimensions.height };
const vaseScale = 1.5;
const diningChairScale = 1.04 * 1.2;
const whiteSofaTable = { name: 'planning-side-table-between-seats', x: 6.93, z: -1.76, ...coffeeTableDimensions };
const furniture = [
  { url: new URL('../vendor/sikisi/sofa-01/sofa-01.glb', import.meta.url), placements: [
    { name: 'planning-sofa', x: sofaOffset, z: rightSofaZ, scale: rightSofaScale, faceTable: true },
  ] },
  { url: new URL('../vendor/sikisi/sofa-02/sofa-02.glb', import.meta.url), placements: [
    { name: 'planning-sofa-left', x: -6.49, z: leftSofaZ, width: rightSofaWidth * 1.10, faceTable: true },
  ] },
  { url: new URL('../vendor/sikisi/dining-chair-02/dining-chair-02.glb', import.meta.url), placements: [
    { name: 'planning-chair', x: -.23, z: 3.17, yaw: Math.PI, scale: diningChairScale },
    { name: 'planning-chair-right', x: 2.02, z: 1.49, yaw: -Math.PI / 2, scale: diningChairScale, floorY: .0505 },
  ] },
  { url: new URL('../vendor/sikisi/armchair-01/armchair-01.glb', import.meta.url), placements: [
    { name: 'planning-armchair', x: 7.10, z: -.65, scale: 1.4, yaw: Math.PI / 9, faceTable: whiteSofaTable },
  ] },
  { url: new URL('../vendor/sikisi/wooden-table-02-poly-haven/wooden-table-02-poly-haven.glb', import.meta.url), placements: [
    { name: 'planning-side-table', x: -5.30, z: -2.60, ...coffeeTableDimensions },
    whiteSofaTable,
    { name: 'planning-side-table-left-corner', x: -7.86, z: -4.94, ...vaseTableDimensions },
    { name: 'planning-side-table-right-corner', x: 7.86, z: -4.94, ...vaseTableDimensions },
  ] },
  { url: new URL('../vendor/sikisi/library-oak-bookcase/library-oak-bookcase-lod0.glb', import.meta.url), placements: [
    { name: 'planning-bookcase', x: ROOM_WALL_X - .43, z: 1.04, yaw: -Math.PI / 2 },
  ] },
  { url: new URL('../vendor/sikisi/antique-ceramic-vase-01/antique-ceramic-vase-01.glb', import.meta.url), placements: [
    { name: 'planning-vase-antique', scale: vaseScale, support: 'planning-side-table-left-corner' },
  ] },
  { url: new URL('../vendor/sikisi/ceramic-vase-01/ceramic-vase-01.glb', import.meta.url), placements: [
    { name: 'planning-vase-ceramic', scale: vaseScale, support: 'planning-side-table-right-corner' },
  ] },
];

export async function loadPlanningFurniture(scene, renderer) {
  const textures = new KTX2Loader().detectSupport(renderer);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(textures);
  const table = scene.getObjectByName('planning-main-table').getWorldPosition(new Vector3());
  const loaded = await Promise.allSettled(furniture.map(({ url }) => loader.loadAsync(url.href)));
  textures.dispose();

  const bounds = new Box3();
  const props = [];
  loaded.forEach((result, index) => {
    const { placements } = furniture[index];
    if (result.status === 'rejected') {
      console.warn(`Lair: could not load ${placements[0].name}`, result.reason);
      return;
    }
    const source = result.value.scene;
    const modelSize = bounds.setFromObject(source).getSize(new Vector3());
    for (const { name, x, z, scale = 1, width, height, yaw = 0, faceTable, support, floorY = ROOM_FLOOR_Y } of placements) {
      const model = source.clone();
      model.name = name;
      const horizontalScale = width ? width / modelSize.x : scale;
      const verticalScale = height ? height / modelSize.y : horizontalScale;
      model.scale.set(horizontalScale, verticalScale, horizontalScale);
      model.position.set(x ?? 0, floorY, z ?? 0);
      if (support) {
        const supportingTable = scene.getObjectByName(support);
        if (!supportingTable) continue;
        bounds.setFromObject(supportingTable).getCenter(model.position);
        model.position.y = bounds.max.y;
      }
      const target = faceTable === true ? table : faceTable;
      model.rotation.y = yaw;
      if (target) model.rotation.y += Math.atan2(target.x - model.position.x, target.z - model.position.z);
      const surfaceY = model.position.y;
      model.position.y += surfaceY - bounds.setFromObject(model).min.y;
      model.traverse(object => {
        if (!object.isMesh) return;
        object.receiveShadow = true;
        object.castShadow = !support;
      });
      scene.add(model);
      props.push(model);
    }
  });
  return props;
}
