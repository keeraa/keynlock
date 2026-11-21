import * as THREE from 'three';
import { DISTRICTS, LOCATIONS } from './world-data.js';
import { makeHeightSampler, northTerrainEdge } from './terrain.js';
import { connectHousePaths } from './navigation/house-paths.js';
import { buildPedestrianNetwork } from './navigation/pedestrian-network.js';
import {acquireHouseAtmosphereResources} from './buildings/house-atmosphere.js';
import {populateCityHouseLots} from './city/city-house-lots.js';
import {createCityScenery} from './city/city-scenery.js';
import {createCityIndustry} from './city/city-industry.js';
import {createCityWaterfront} from './city/city-waterfront.js';
import {createCityMeshes} from './city/city-meshes.js';
import {createCityCoast} from './city/city-coast.js';
import {createCityRoads} from './city/city-roads.js';
import {createCityBuildings} from './city/city-buildings.js';
import {createCityNightLighting} from './city/city-night.js';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function seeded(seed) {let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
const ROOT_COORDINATES={minX:-110,maxX:58,minZ:-88,maxZ:43};

/** Layout and all decorative parts live in the same world coordinate system. */
export function createCity({THREE: T=THREE,scene,materials}) {
  const random=seeded(271828);
  const batches=new Map();
  const surfaces=new Map();
  const objects=[];
  const boats=[];
  const boatSails=[];
  const occupiedLots=[];
  const houseEntrances=[];
  const housePaths=[];
  const landmarkPaths=[],publicPaths=[],industryPaths=[],industryAnchors=[],gardenPaths=[],additionalPaths=[];
  const newHousePlacements=new Map();
  const waterfrontWarehouses=[];
  const smokePuffs=[];
  const windowLightSites=[];
  const houseAtmosphereResources=acquireHouseAtmosphereResources(T);
  const streetLampSites=[];
  const stairRuns=[];
  const palaceEntrySteps=[];
  const palaceWindowPanes=[];
  const effectMaterials=[];
  const geometries={
    box:new T.BoxGeometry(1,1,1),
    cylinder:new T.CylinderGeometry(1,1,1,9),
    tower:new T.CylinderGeometry(.78,1.02,1,8),
    cone:new T.ConeGeometry(1,1,8),
    dome:new T.SphereGeometry(1,10,7),
    crown:new T.IcosahedronGeometry(1,1),
  };
  const smokePosition=new T.Vector3(),smokeScale=new T.Vector3(),smokeRotation=new T.Quaternion(),smokeMatrix=new T.Matrix4();
  const coast=x=>20.8+2.85*Math.sin(x*.075)+1.35*Math.sin(x*.19+1.3)
    +.38*Math.sin(x*.46-.7)+1.5*Math.exp(-Math.pow((x+19)/7,2));
  const riverGuides=[[-90,-112],[-87,-104],[-81,-96],[-78,-89],[-73,-78],[-68,-66],[-61,-54],
    [-58,-49],[-47,-43],[-37,-32],[-29,-23],[-24,-14],[-22,-5],[-24,4],[-22,14],[-20,19],[-19,23],[-19,29],[-18,36]];
  // A continuous channel follows the same smooth curve in the ground, water
  // mesh, bank vegetation and bridge calculations. Sharp polyline elbows had
  // produced zigzag river edges and triangular wedges beside the bridges.
  const riverCurve=new T.CatmullRomCurve3(riverGuides.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal');
  const riverPoints=riverCurve.getPoints(154).map(point=>[point.x,point.z]);
  const headwaterFade=(x,z)=>smoothEase(northTerrainEdge(x)+.6,northTerrainEdge(x)+12,z);
  const riverWidth=(x,z)=>(4.25+3.5*smoothEase(-102,-51,z)+1.25*smoothEase(9,26,z)
    +.42*Math.sin(z*.115+x*.035)+.2*Math.sin(z*.31-x*.15))*headwaterFade(x,z);
  const heightAt=makeHeightSampler(coast,riverPoints);
  let terrain;
  let terrainSurfaceAt=heightAt;

  function smoothEase(a,b,value) {
    const t=clamp((value-a)/(b-a),0,1);
    return t*t*(3-2*t);
  }

  const {part,local,collectSurface,ribbon,pavedRectangle,foundationDepth,finalize,finalizeSurfaces}=createCityMeshes({T,scene,materials,batches,surfaces,objects,geometries,heightAt,terrainSurfaceAt:(x,z)=>terrainSurfaceAt(x,z)});
  const {landAndSea}=createCityCoast({T,scene,materials,coast,heightAt,part,ribbon,clamp,objects,
    setTerrain:(land,surfaceAt)=>{terrain=land;terrainSurfaceAt=surfaceAt;}});

  const roadSystem=createCityRoads({T,materials,coast,riverPoints,riverWidth,headwaterFade,heightAt,terrainSurfaceAt:(x,z)=>terrainSurfaceAt(x,z),local,part,ribbon,collectSurface,stairRuns,clamp,ROOT_COORDINATES,northTerrainEdge});
  const {mainRoads,minorRoads,bridges,factorySites,fieldPlots,pierLayouts,farmAccess,upperFarmAccess,reserved,atPolyline,isBuildable,bridgeProfiles,pavedRoadHeight,roadStairs,infrastructure}=roadSystem;
  const {tree,scenicFree,groundPatch,bench,gardensAndTrees,hillsideLandscaping,riverbankLandscaping,greenOutskirts,upperCityGarden,oldTownMarket,streetFurniture}=createCityScenery({T,TAU,random,part,coast,riverPoints,riverWidth,mainRoads,minorRoads,atPolyline,reserved,occupiedLots,housePaths,additionalPaths,scenicPaths:gardenPaths,materials,collectSurface,terrainSurfaceAt:(x,z)=>terrainSurfaceAt(x,z),bridgeProfiles,heightAt,farmAccess,pavedRectangle,ribbon,streetLampSites});
  const industry=createCityIndustry({T,random,TAU,part,factorySites,heightAt,foundationDepth,geometries,effectMaterials,smokePuffs,scene,groundPatch,ribbon,pavedRoadHeight,fieldPlots,farmAccess,upperFarmAccess,materials,walkingPaths:industryPaths,walkingAnchors:industryAnchors});
  const {factoryComplex,agriculturalFields,countrysideWindmill}=industry;
  const {portAndQuays,boatsAndWaves}=createCityWaterfront({T,scene,materials,part,coast,heightAt,foundationDepth,pierLayouts,waterfrontWarehouses,boats,boatSails,effectMaterials});
  const buildingSystem=createCityBuildings({T,scene,materials,newHousePlacements,objects,houseAtmosphereResources,windowLightSites,heightAt,pavedRectangle});
  const {addDetailedBuildings,landmarkAccess,setBuildingAtmosphereSettings}=buildingSystem;
  function update(time) {
    if(windmillRotor)windmillRotor.rotation.z=-time*.23;
    for(let i=0;i<smokePuffs.length;i++) {
      const puff=smokePuffs[i];
      const life=(time*.095+i*.00027+puff.phase)%1;
      smokePosition.set(puff.x+life*2.35+Math.sin(time*.23+puff.drift)*.31,
        puff.height+life*7.3,puff.z-life*.85);
      const size=.45+life*1.8;
      smokeScale.set(size*1.15,size*.62,size);
      smokeMatrix.compose(smokePosition,smokeRotation,smokeScale);
      smokeBatch.setMatrixAt(i,smokeMatrix);
    }
    if(smokeBatch)smokeBatch.instanceMatrix.needsUpdate=true;
    buildingSystem.update(time);
    for(const boat of boats) {
      const phase=time*boat.speed+boat.phase;
      const vx=-boat.rx*Math.sin(phase)*boat.speed;
      const vz=boat.rz*Math.cos(phase)*boat.speed;
      boat.group.position.set(boat.centerX+boat.rx*Math.cos(phase),
        -.54+Math.sin(time*1.15+boat.phase)*.105,
        boat.centerZ+boat.rz*Math.sin(phase));
      boat.group.rotation.set(Math.sin(time*.8+boat.phase)*.027,
        Math.atan2(-vz,vx),
        Math.cos(time*.95+boat.phase)*.04);
    }
  }
  const {nightEmitters,createNightLights,updateNightLights,setNightLighting}=createCityNightLighting({T,scene,houseAtmosphereResources,effectMaterials,streetLampSites,windowLightSites,setBuildingAtmosphereSettings});
  const waterMats=landAndSea();
  infrastructure(waterMats);
  populateCityHouseLots({random,atPolyline,riverPoints,isBuildable,
    occupiedLots,newHousePlacements,houseEntrances,windowLightSites,
    heightAt,foundationDepth,local});
  // Architecture and real stair positions are known before paths are routed.
  // The old order ignored landmark footprints and often paved through them.
  addDetailedBuildings();
  const {paths:accessPaths,anchors:accessAnchors}=connectHousePaths({
    mainRoads,minorRoads,houseEntrances,occupiedLots,riverPoints,
    atPolyline,clamp,coast,ROOT_COORDINATES,housePaths,
    landmarkEntrances:landmarkAccess,landmarkPaths,publicPaths,
    publicEntrances:[
      {id:'market',kind:'market',x:-16.3,z:12.4,forward:[0,-1],width:1.05},
      {id:'upper-garden',kind:'garden',x:43,z:-43.7,forward:[0,-1],width:.9},
    ],
    obstacles:[...landmarkAccess.map(access=>access.lot),
      ...factorySites.map(([x,z,w,d])=>({x,z,halfX:w/2+.2,halfZ:d/2+.2}))],
    ribbon,pavedRoadHeight,roadStairs,
  });
  additionalPaths.push(...landmarkPaths,...publicPaths);
  factoryComplex();agriculturalFields();countrysideWindmill();
  const {windmillRotor,smokeBatch}=industry;
  upperCityGarden();oldTownMarket();portAndQuays();
  const pedestrianNetwork=buildPedestrianNetwork({roads:[...mainRoads,...minorRoads],
    paths:[...accessPaths,...industryPaths,...gardenPaths],
    anchors:[...accessAnchors,...industryAnchors]});
  gardensAndTrees();hillsideLandscaping();riverbankLandscaping();greenOutskirts();streetFurniture();boatsAndWaves();
  const surfaceStats={before:[...surfaces.values()].reduce((total,group)=>total+group.length,0),after:surfaces.size};
  const hits=finalize();
  finalizeSurfaces(waterMats);
  createNightLights();
  setBuildingAtmosphereSettings();
  update(0);
  const districtAt=(x,z)=>{
    if(z>13)return 'port';
    if(z<-48&&x>-13&&x<19)return 'palace';
    if(x<-50&&z<-12)return 'industrial';
    if(x>19&&z<-13)return 'upper';
    if(x>19)return 'arts';
    if(x<-13)return 'old';
    return 'bohemian';
  };
  return {districts:DISTRICTS,locations:LOCATIONS,water:waterMats.sea,terrain,heightAt,hits,coast,districtAt,update,surfaceStats,housePaths,houseEntrances,
    landmarkPaths,publicPaths,pedestrianNetwork,
    roadNetwork:[...mainRoads,...minorRoads],riverPoints,bridgeLocations:bridges,
    bridgeProfiles,factorySites,fieldPlots,pierLayouts,riverWidth,waterfrontWarehouses,stairRuns,palaceEntrySteps,palaceWindowPanes,
    windmillRotor,
    roadSurfaceHeight:pavedRoadHeight,terrainSurfaceHeight:terrainSurfaceAt,riverSurfaceHeight:roadSystem.riverSurfaceHeight,
    nightLightSites:{lamps:streetLampSites,windows:windowLightSites},
    setNightLighting,updateNightLights,setBuildingAtmosphereSettings,
    setWaterTime:time=>waterMats.setTime(time),
    setWaterView:eye=>waterMats.setView(eye),
    setWaterLighting:time=>waterMats.setTimeOfDay(time),
    dispose() {
      for(const mesh of hits){scene.remove(mesh);mesh.dispose();}
      for(const obj of objects){scene.remove(obj);obj.geometry?.dispose();}
      buildingSystem.dispose();
      if(smokeBatch){scene.remove(smokeBatch);smokeBatch.dispose();}
      for(const boat of boats){scene.remove(boat.group);boat.group.traverse(child=>{if(child.isMesh)child.geometry.dispose();});}
      for(const material of boatSails)material.dispose();
      if(windmillRotor){scene.remove(windmillRotor);for(const geometry of windmillRotor.userData.bladeGeometries)geometry.dispose();}
      for(const material of effectMaterials)material.dispose();
      for(const {light,glow} of nightEmitters){scene.remove(light);scene.remove(glow);}
      houseAtmosphereResources.release();
      waterMats.dispose();
      for(const g of Object.values(geometries))g.dispose();
    }
  };
}
