// City house instancing, landmark placement and their shared atmosphere lifecycle.
import {createHouseModel} from '../buildings/house-model.js';
import {batchHouseGeometry} from '../buildings/house-batch.js';
import {createHouseGlass} from '../buildings/house-materials.js';
import {createHouseMossGeometry,setHouseMossGeometryHeight,houseChimneyOutlet,loadBuildingAtmosphereSettings} from '../buildings/house-atmosphere.js';
import {createBuildingSmokeBatch} from '../../modules/house-builder/core/building-smoke-batch.js';
import {windowLayout} from '../buildings/house-layout.js';
import {createLandmarkModel} from '../landmarks/landmark-model.js';
import {createLandmarkAtmosphere} from '../landmarks/landmark-atmosphere.js';
import {DISTRICT_PROFILES} from '../street/district-profiles.js';

export function createCityBuildings(ctx) {
  const {T,scene,materials,newHousePlacements,objects,houseAtmosphereResources,windowLightSites,heightAt,pavedRectangle}=ctx;
  const houseGlass=createHouseGlass(T);
  let buildingSettings=loadBuildingAtmosphereSettings(),buildingGlassEnvironment=null;
  const cityMossBatches=[],cityHouseModels=[],cityLandmarkModels=[],citySmokeParticles=[],landmarkAccess=[];
  let cityHouseSmoke=null,cityHouseSmokeBatch=null;
  function addDetailedBuildings() {
    const dummy=new T.Object3D();
    const foundations=[...newHousePlacements.values()].flat();
    const plinths=new T.InstancedMesh(new T.BoxGeometry(1,1,1),materials.get('stone'),foundations.length);
    plinths.name='legacy-geography-house-foundations';
    plinths.castShadow=true;plinths.receiveShadow=true;
    foundations.forEach(({x,z,angle,width,depth,ground,foundation},index)=>{
      dummy.position.set(x,ground-foundation/2+.08,z);
      dummy.rotation.set(0,angle,0);
      dummy.scale.set(width+.08,foundation,depth+.08);
      dummy.updateMatrix();plinths.setMatrixAt(index,dummy.matrix);
    });
    plinths.instanceMatrix.needsUpdate=true;plinths.computeBoundingSphere();
    scene.add(plinths);objects.push(plinths);
    for(const [key,positions] of newHousePlacements) {
      const split=key.lastIndexOf('-');
      const district=key.slice(0,split),variant=Number(key.slice(split+1));
      const profile=DISTRICT_PROFILES[district]||DISTRICT_PROFILES.old;
      const config={
        floors:Math.min(profile.floors[1],profile.floors[0]+variant%4),
        width:Math.min(12,profile.width[0]+(variant%5)*.72),
        depth:Math.min(10,profile.depth[0]+(variant%4)*.55),
        roofType:profile.roofs[variant%profile.roofs.length],
        roofHeight:1.1+(variant%5)*.43,
        roofColor:profile.roofsPalette[variant%profile.roofsPalette.length],
        plasterColor:profile.walls[variant%profile.walls.length],
        woodColor:profile.woods[variant%profile.woods.length],
        frontWindows:2+variant%3,sideWindows:1+variant%3,
        windowStyle:profile.details.arch>.5&&variant%4?'arched':'straight',
        doorStyle:profile.details.arch>.5?'arched':'straight',
        shutters:profile.details.shutters>.45&&variant%4!==0,
        chimney:profile.details.chimney>.45&&variant%5!==0,
        balcony:variant%3===2&&profile.details.balcony>.5,
        timberFrame:profile.details.timberFrame>.4&&variant%3!==1,
        plasterDamage:variant%3===1&&profile.details.damage>.38,
        damageAmount:25,
      };
      const model=createHouseModel(T,config,{detail:'low',glass:houseGlass});
      cityHouseModels.push(model);
      batchHouseGeometry(T,model.group);
      for(const part of model.group.children) {
        if(!part.isMesh)continue;
        const mesh=new T.InstancedMesh(part.geometry,part.material,positions.length);
        mesh.name=`legacy-geography-detailed-${key}`;
        mesh.castShadow=true;mesh.receiveShadow=true;
        positions.forEach(({x,z,angle,width,depth,ground},index)=>{
          dummy.position.set(x,ground+.08,z);
          dummy.rotation.set(0,angle,0);
          const widthScale=width/config.width,depthScale=depth/config.depth;
          dummy.scale.set(widthScale,Math.min(1.02,Math.max(.66,(widthScale+depthScale)*.9)),depthScale);
          dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
        scene.add(mesh);objects.push(mesh);
      }
      // One instanced moss shell per house variant, including its door cutout.
      // The same transparently painted sheet is reused across all districts.
      const mossMesh=new T.InstancedMesh(createHouseMossGeometry(T,config,{height:buildingSettings.mossHeight/100}),houseAtmosphereResources.mossMaterial,positions.length);
      mossMesh.name=`city-gouache-house-moss-${key}`;
      mossMesh.frustumCulled=false;
      mossMesh.renderOrder=2;
      const updateMossMatrices=()=>{
        positions.forEach(({x,z,angle,width,depth,ground},index)=>{
          const widthScale=width/config.width,depthScale=depth/config.depth;
          const verticalScale=Math.min(1.02,Math.max(.66,(widthScale+depthScale)*.9));
          dummy.position.set(x,ground+.08,z);dummy.rotation.set(0,angle,0);
          dummy.scale.set(widthScale,verticalScale,depthScale);
          dummy.updateMatrix();mossMesh.setMatrixAt(index,dummy.matrix);
        });
        mossMesh.instanceMatrix.needsUpdate=true;mossMesh.computeBoundingSphere();
      };
      cityMossBatches.push(mossMesh);
      updateMossMatrices();
      scene.add(mossMesh);objects.push(mossMesh);
      const chimney=houseChimneyOutlet(config);
      const litWindow=windowLayout(config).front[0];
      positions.forEach(({x,z,angle,width,depth,ground},index)=>{
        const widthScale=width/config.width,depthScale=depth/config.depth;
        const verticalScale=Math.min(1.02,Math.max(.66,(widthScale+depthScale)*.9));
        if(chimney){
          const cx=x+Math.cos(angle)*chimney.x*widthScale+Math.sin(angle)*chimney.z*depthScale;
          const cz=z-Math.sin(angle)*chimney.x*widthScale+Math.cos(angle)*chimney.z*depthScale;
          for(let p=0;p<3;p++)citySmokeParticles.push({x:cx,y:ground+.08+chimney.y*verticalScale,
            z:cz,phase:p/3+(index%7)*.031,seed:index*.71+p*1.53});
        }
        if(litWindow&&index%2===0){
          const wx=x+Math.cos(angle)*litWindow.x*widthScale+Math.sin(angle)*depth*.53;
          const wz=z-Math.sin(angle)*litWindow.x*widthScale+Math.cos(angle)*depth*.53;
          windowLightSites.push({x:wx,y:ground+.08+litWindow.y*verticalScale,z:wz});
        }
      });
    }
    const landmarks=[
      ['palace',5,-57,.64],['museum',32,0,.47],
      ['theater',0,-5,.43],['townhall',-46,.15,.39],
      ['church',-35,-6,.42],['tower',42,-32,.38],
    ];
    for(const [id,x,z,scale] of landmarks) {
      const model=createLandmarkModel(T,id,{detail:'medium'});
      model.group.position.set(x,heightAt(x,z)+.15,z);
      model.group.scale.setScalar(scale);
      model.group.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(model.group);
      const lot={id,x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,
        halfX:(bounds.max.x-bounds.min.x)/2,halfZ:(bounds.max.z-bounds.min.z)/2};
      const access=model.group.userData.pathAccess;
      if(access)landmarkAccess.push({id:`landmark-${id}`,kind:'landmark',x:x+access.x*scale,
        z:z+access.z*scale,forward:access.forward,lot,width:id==='palace'?1.45:1.1});
      const effects=createLandmarkAtmosphere(T,model,{settings:buildingSettings,mossMap:model.textureMaps.moss});
      effects.group.position.copy(model.group.position);
      effects.group.scale.copy(model.group.scale);
      scene.add(model.group,effects.group);objects.push(model.group);
      cityLandmarkModels.push({model,effects});
    }
    if(citySmokeParticles.length){
      cityHouseSmokeBatch=createBuildingSmokeBatch(T,citySmokeParticles,{
        resources:houseAtmosphereResources,settings:buildingSettings,
        name:'city-instanced-gouache-chimney-smoke',
      });
      cityHouseSmoke=cityHouseSmokeBatch.points;
      scene.add(cityHouseSmoke);
    }
    // The previous raised palace paving was built for the removed castle's
    // tall stone plinth; the detailed palace sits directly on the hill.
    pavedRectangle(32,7,14,4.6,.055,'paving');
    pavedRectangle(0,2.3,8,5,.049);
    pavedRectangle(-42,-.45,10.6,7.2,.072,'paving');
  }

  function setBuildingAtmosphereSettings(patch={},envMap=buildingGlassEnvironment){
    const previousHeight=buildingSettings.mossHeight;
    buildingSettings={...buildingSettings,...patch};
    buildingGlassEnvironment=envMap;
    houseAtmosphereResources.mossMaterial.opacity=Math.min(1,buildingSettings.mossDensity*.013);
    for(const mesh of cityMossBatches){
      mesh.visible=Boolean(buildingSettings.moss)&&buildingSettings.mossDensity>0;
      if(buildingSettings.mossHeight!==previousHeight)
        setHouseMossGeometryHeight(mesh.geometry,buildingSettings.mossHeight/100);
    }
    cityHouseSmokeBatch?.setSettings(buildingSettings);
    houseGlass.setAppearance({gloss:buildingSettings.glassGloss,reflection:buildingSettings.glassReflection,
      night:buildingSettings.night,glow:buildingSettings.windowGlow,envMap:buildingGlassEnvironment?.texture??null});
    for(const {model,effects} of cityLandmarkModels){
      model.setWindowAppearance({gloss:buildingSettings.glassGloss,reflection:buildingSettings.glassReflection,
        night:buildingSettings.night,glow:buildingSettings.windowGlow,envMap:buildingGlassEnvironment?.texture??null});
      effects.setSettings(buildingSettings);
    }
  }

  function update(time) {
    cityHouseSmokeBatch?.update(time);
    for(const {effects} of cityLandmarkModels)effects.update(time);
  }
  function dispose() {
    if(cityHouseSmokeBatch){scene.remove(cityHouseSmoke);cityHouseSmokeBatch.dispose();}
    for(const {effects,model} of cityLandmarkModels){scene.remove(effects.group);effects.dispose();model.dispose();}
    for(const model of cityHouseModels)model.dispose();
    houseGlass.dispose();
  }
  return {addDetailedBuildings,landmarkAccess,setBuildingAtmosphereSettings,update,dispose};
}
