import {createPlayerCamera} from './camera.js';
import {addArchiveLighting} from './lighting.js';
import {createArchiveClouds} from '../environment/clouds.js';
import {createSky} from '../environment/sky.js';
import {makeLayout} from '../architecture/layout.js';
import {createMaterials} from '../architecture/materials.js';
import {createArchiveBuilding} from '../architecture/create-building.js';
import {createNavigation} from '../player/movement.js';
import {createLairInk} from '../rendering/lair-ink.js';
import {createHallVisibility} from './hall-visibility.js';
import {batchStatic} from '../rendering/static-batches.js';
// Public integration point. Hosts supply their existing engine and renderer.
export function createArchiveScene({THREE,config,cloudSettings={},translate=value=>value}){
 let disposed=false;
 const scene=new THREE.Scene();let sky=createSky(THREE);scene.background=sky;scene.fog=new THREE.FogExp2(0xa7b8ad,.0025);
 const materials=createMaterials(THREE),layout=makeLayout(config),navigation=createNavigation(config,layout);
 const building=createArchiveBuilding({THREE,config,layout,materials,translate});scene.add(building.root);
 const camera=createPlayerCamera(THREE,config);scene.add(camera);
 const lighting=addArchiveLighting(THREE,scene,config);
 const wingBodies=building.root.children.filter(child=>child.userData.galleryId);
 const roofGroups=building.roofs.children.filter(child=>child.isGroup);
 const wingParts=[...wingBodies,...roofGroups.filter(child=>child.userData.galleryId)];
 const batch=batchStatic(THREE,building.root,[building.root,building.roofs,building.upper,...roofGroups]);
 const hallVisibility=createHallVisibility(THREE,layout,config.building);
 let previousMask=-1;
 function updateVisibility(camera,showAll=false){
  hallVisibility.update(camera,showAll);
  let mask=0;
  for(let i=0;i<layout.halls.length;i++)if(hallVisibility.visible.has(layout.halls[i].id))mask|=1<<i;
  if(mask===previousMask)return false;
  previousMask=mask;
  batch.selectRooms(hallVisibility.visible);
  for(const part of wingParts)part.visible=hallVisibility.visible.has(part.userData.galleryId);
  return true;
 }
 const ink=createLairInk(THREE);
 const inked=[];
 building.root.traverse(o=>{if(o.isMesh && (o.material===materials.gold || o.material===materials.darkWood))inked.push(o);});
 for(const mesh of inked)mesh.add(ink.shell(mesh.geometry));
 const clouds=createArchiveClouds({THREE,scene,camera,config,settings:cloudSettings});
 function setSkyColor(color){
  if(color===sky.userData.color)return;
  const previous=sky;
  sky=createSky(THREE,color);scene.background=sky;previous.dispose();
 }
 return {scene,camera,layout,navigation,building,clouds,ink,setSkyColor,updateVisibility,visibleHalls:hallVisibility.visible,stats:{...building.stats,batches:batch.count},
  dispose(){if(disposed)return;disposed=true;clouds.dispose();ink.dispose();batch.dispose();building.dispose();materials.dispose();sky.dispose();lighting.dispose();scene.clear();},
 };
}
