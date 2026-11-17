import { createHousePrimitives } from './geometry/primitives.js';
import { createRoofParts } from './geometry/roof.js';
import { createOpenings } from './geometry/openings.js';
import { createHouseDetails } from './geometry/details.js';
import { getHouseDimensions, normalizeHouseConfig } from './house-config.js';
import { windowLayout } from './house-layout.js';
import { createHouseResourceManager, disposeHouseGeometry } from './house-resource-manager.js';

// Geometry is generated in local coordinates. No city/renderer dependency:
// multiple house instances can later share one blueprint and material cache.
const BASE = .32;
const PALETTE_KEYS=new Set(['roofColor','plasterColor','woodColor']);

// Both roof slopes run through the wall tops and meet at the ridge.
// The overhang descends below the top of the wall instead of floating above it.
export function gableRoofProfile(config, wallTop, eave = .42) {
  const halfWidth = config.width / 2;
  return {
    span: halfWidth + eave,
    ridgeY: wallTop + config.roofHeight,
    edgeY: wallTop - config.roofHeight * eave / halfWidth,
  };
}

// Each slope samples a single (non-wrapping) painted sheet. Hip faces have
// different eave lengths: giving both the entire sheet makes the shorter face
// look more densely tiled. Use the same physical horizontal scale for every
// face, cropping the shorter face from the middle of the texture instead.
export function roofSurfaceUV(point, face, bounds) {
  const horizontal = face === 'end' ? point[0] : point[2];
  const midpoint = (bounds.minHorizontal + bounds.maxHorizontal) / 2;
  const textureSpan = bounds.referenceHorizontalSpan || (bounds.maxHorizontal - bounds.minHorizontal);
  const verticalScale = bounds.slopeLength && bounds.referenceSlopeLength
    ? bounds.slopeLength / bounds.referenceSlopeLength : 1;
  return [
    .5 + (horizontal - midpoint) / textureSpan,
    (point[1] - bounds.minY) / (bounds.maxY - bounds.minY) * verticalScale,
  ];
}

export function housePolygonCount(root) {
  let triangles=0;
  root.traverse(child=>{
    if(!child.isMesh)return;
    const geometry=child.geometry;
    const vertices=geometry.index?.count??geometry.getAttribute('position')?.count??0;
    triangles+=vertices/3;
  });
  return Math.round(triangles);
}

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function paintedTexture(THREE, kind) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rand = random(kind === 'roof' ? 23456 : kind === 'wood' ? 39188 : 85612);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  if (kind === 'roof') {
    // Slightly uneven painted clay tiles, arranged in staggered courses.
    for (let row = -1; row < 15; row++) {
      for (let col = -1; col < 13; col++) {
        const x = col * 48 + (row % 2 ? 24 : 0);
        const y = row * 39;
        const shade = 1 - rand() * .15;
        ctx.fillStyle = `rgba(53,40,35,${(1 - shade) * .7})`;
        ctx.fillRect(x + 2, y + 4, 46, 35);
        ctx.strokeStyle = `rgba(45,31,24,${.18 + rand() * .16})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 37); ctx.quadraticCurveTo(x + 23, y + 44, x + 47, y + 37);
        ctx.moveTo(x + 2, y + 3); ctx.lineTo(x + 2, y + 36);
        ctx.stroke();
        if (rand() > .45) {
          ctx.strokeStyle = `rgba(255,255,255,${.14 + rand() * .12})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + 7, y + 9); ctx.lineTo(x + 28, y + 11); ctx.stroke();
        }
      }
    }
  } else if (kind === 'wood') {
    for (let i = 0; i < 550; i++) {
      const y = rand() * 512;
      ctx.strokeStyle = `rgba(45,25,12,${.04 + rand() * .12})`;
      ctx.lineWidth = .5 + rand() * 2;
      ctx.beginPath(); ctx.moveTo(rand() * 512, y);
      ctx.bezierCurveTo(180, y - 4, 320, y + 4, 512, y); ctx.stroke();
    }
  } else {
    for (let i = 0; i < 5200; i++) {
      const x = rand() * 512, y = rand() * 512;
      const tone = rand() > .4 ? '40,28,19' : '255,255,255';
      ctx.fillStyle = `rgba(${tone},${.016 + rand() * .058})`;
      ctx.fillRect(x, y, 1.5 + rand() * 14, .8 + rand() * 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.repeat.set(kind === 'roof' ? 1 : kind === 'wood' ? 1 : 1.6, kind === 'roof' ? 1 : 1.6);
  return tex;
}

export function createHouseModel(THREE, initialConfig, {detail='high'}={}) {
  if(!['high','medium','low'].includes(detail))throw new Error(`Неизвестный уровень детализации дома: ${detail}`);
  const simplified=detail!=='high', minimal=detail==='low';
  const group = new THREE.Group();
  group.name = 'KEYNLOCK — параметрический дом';
  const resources = createHouseResourceManager(THREE,paintedTexture);
  const mats = resources.materials;
  let disposed = false;

  const {box,cylinder,beam,triangle,roofSurface} = createHousePrimitives({THREE,mats,roofSurfaceUV});
  const {createRoof} = createRoofParts({mats,box,beam,triangle,roofSurface,gableRoofProfile});
  const {addWindow,addDoor} = createOpenings({THREE,mats,box,cylinder,simplified,minimal});
  const {addCornice,addPlasterDamage,addBalcony,addEntranceSteps,addTimberFrame,addChimney} = createHouseDetails({THREE,mats,BASE,box,addDoor,minimal,random});

  function update(rawConfig) {
    const c=normalizeHouseConfig(rawConfig);
    const previous=group.userData.config;
    // Palette changes only affect shared materials. Recreating hundreds of
    // window meshes on a colour-slider drag causes unnecessary frame stalls,
    // particularly after the house has been geometry-batched in the editor.
    if(previous&&Object.keys(c).every(key=>PALETTE_KEYS.has(key)||previous[key]===c[key])){
      resources.setColors(c);
      group.userData.config=c;
      return group.userData.metrics;
    }
    const dims=getHouseDimensions(c);
    const layout=windowLayout(c);
    // Geometries belong to each generated house. Paint maps/materials are shared
    // across rebuilds so color and window adjustments avoid texture churn.
    disposeHouseGeometry(group);
    resources.setColors(c);

    const top=BASE+dims.walls;
    const permanent=mesh=>{mesh.userData.houseInvariant=true;return mesh;};
    permanent(box(group,[c.width+.32,.4,c.depth+.32],[0,.2,0],mats.stone));
    permanent(box(group,[c.width+.15,.12,c.depth+.15],[0,.46,0],mats.stoneBand));
    box(group,[c.width,dims.walls,c.depth],[0,BASE+dims.walls/2,0],mats.plaster);
    // Corner stones, foundation courses and restrained window cornices.
    if(!minimal)for(const x of [-1,1])for(const z of [-1,1]) {
      for(let i=0;i<Math.ceil(dims.walls/.54);i+=simplified?3:1) {
        const y=BASE+.23+i*.53;
        if(y>top-.1)continue;
        box(group,[.25,.23,.31],[x*(c.width/2-.03),y,z*(c.depth/2-.03)],i%2?mats.stoneLight:mats.highlight);
      }
    }
    for(let floor=1;floor<c.floors;floor++) {
      const y=BASE+floor*c.floorHeight;
      addCornice(group,c,y);
    }
    for(const win of layout.front) {
      const windowGroup=new THREE.Group();
      windowGroup.position.set(win.x,win.y,c.depth/2-.065);
      group.add(windowGroup);
      addWindow(windowGroup,win.width,c.windowStyle,c.shutters);
    }
    for(const win of layout.sides)for(const side of [-1,1]) {
      const windowGroup=new THREE.Group();
      windowGroup.position.set(side*(c.width/2-.065),win.y,win.z);
      windowGroup.rotation.y=side*Math.PI/2;
      group.add(windowGroup);
      addWindow(windowGroup,win.width,c.windowStyle,c.shutters);
    }
    addDoor(group,c,BASE+.02,c.depth/2-.135);
    addEntranceSteps(group,c);
    addBalcony(group,c,layout);
    const permanentStart=group.children.length;
    addTimberFrame(group,c,top);
    if(!minimal)addPlasterDamage(group,c,top,layout);
    createRoof(group,c,top);
    addChimney(group,c,top);
    for(const child of group.children.slice(permanentStart)){
      // Damage decals change with LOD. The roof, timber and chimney do not.
      if(child.userData.plasterDamage)continue;
      child.traverse(mesh=>{if(mesh.isMesh)mesh.userData.houseInvariant=true;});
    }
    // These surfaces keep the same silhouette and paint across all LODs.
    // During a detail transition they must never be drawn twice as transparent
    // meshes: overlapping plaster/roof faces caused conspicuous zoom flicker.
    group.userData={config:c,detail,shellMaterials:[mats.plaster,mats.roof,mats.roofEdge,mats.roofTop],
      metrics:{...dims,windows:layout.totalWindows,frontWindows:layout.front.length,sideWindows:layout.sides.length*2,polygons:housePolygonCount(group)}};
    return group.userData.metrics;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disposeHouseGeometry(group);
    resources.dispose();
  }

  update(initialConfig);
  return {group,update,dispose};
}
