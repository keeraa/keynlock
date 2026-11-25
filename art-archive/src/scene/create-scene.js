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
import {patchSceneShadowHatch} from '../rendering/shadow-hatch.js';
import {createDust} from '../environment/dust.js';
import {addInteriorFinishes} from './interior-finishes.js';
// Public integration point. Hosts supply their existing engine and renderer.
export function createArchiveScene({THREE,renderer,config,loadModel,loadingManager,cloudSettings={},translate=value=>value}){
 let disposed=false;
 const scene=new THREE.Scene();let sky=createSky(THREE);scene.background=sky;scene.fog=new THREE.FogExp2(0xa7b8ad,.0025);
 const materials=createMaterials(THREE,loadingManager),layout=makeLayout(config),navigation=createNavigation(config,layout);
 const ink=createLairInk(THREE);
 const building=createArchiveBuilding({THREE,config,layout,materials,translate,loadModel,onFurnitureLoaded(object){
  ink.add(object);
  if(renderer)renderer.shadowMap.needsUpdate=true;
 }});scene.add(building.root);
 const camera=createPlayerCamera(THREE,config);scene.add(camera);
 const lighting=addArchiveLighting(THREE,scene,config);
 const wingBodies=building.root.children.filter(child=>child.userData.galleryId);
 const roofGroups=building.roofs.children.filter(child=>child.isGroup);
 const wingParts=[...wingBodies,...roofGroups.filter(child=>child.userData.galleryId)];
 const batch=batchStatic(THREE,building.root,[building.root,building.roofs,building.upper,...roofGroups]);
 const finishes=addInteriorFinishes(THREE,building,layout);
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
 const inked=[];
 building.root.traverse(o=>{if(o.isMesh && (o.material===materials.gold || o.material===materials.darkWood))inked.push(o);});
 for(const mesh of inked)mesh.add(ink.shell(mesh.geometry));
 const clouds=createArchiveClouds({THREE,scene,camera,config,settings:cloudSettings});
 patchSceneShadowHatch(building.root);
 const {floorElevation,radius,domeBaseHeight}=config.building,span=radius*.7;
 const dust=createDust(THREE,scene,{min:[-span,floorElevation+.5,-span],max:[span,floorElevation+domeBaseHeight,span],
  count:260,density:1,scale:.64,opacity:.24,light:{
   glsl:`float dustLightAt(vec3 p){return 1.0-smoothstep(${(radius*.36).toFixed(2)},${(radius*.82).toFixed(2)},length(p.xz));}`,
   tint:'#ffedcf',strength:.7,
  }});
 dust.points.layers.set(1);camera.layers.enable(1);
 function setSkyColor(color){
  if(color===sky.userData.color)return;
  const previous=sky;
  sky=createSky(THREE,color);scene.background=sky;previous.dispose();
 }
 return {scene,camera,layout,navigation,building,clouds,dust,ink,wearTexture:materials.wearTexture,setSkyColor,setWallFinish:materials.setWallFinish,updateVisibility,visibleHalls:hallVisibility.visible,stats:{...building.stats,batches:batch.count},
  dispose(){if(disposed)return;disposed=true;clouds.dispose();dust.dispose();ink.dispose();finishes.dispose();batch.dispose();building.dispose();materials.dispose();sky.dispose();lighting.dispose();scene.clear();},
 };
}
