import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.js';
import {createHouseModel} from '../modules/house-builder/core/house-model.js';
import {createHouseGlass} from '../modules/house-builder/core/house-materials.js';
import {createHouseAtmosphere,createHouseMossGeometry,houseChimneyOutlet,
  BUILDING_ATMOSPHERE_DEFAULTS,loadBuildingAtmosphereSettings,
  BUILDING_SMOKE_RISE,BUILDING_SMOKE_RATE,buildingSmokeFade} from '../modules/house-builder/core/house-atmosphere.js';

const config={floors:3,width:8,depth:7,chimney:true,frontWindows:3};
const firstStandalone=createHouseModel(T,config);
const secondStandalone=createHouseModel(T,config);
function windowMaterial(model){
  let material;
  model.group.traverse(mesh=>{if(mesh.userData.glassPane)material=mesh.material;});
  return material;
}
assert.notEqual(windowMaterial(firstStandalone),windowMaterial(secondStandalone),
  'Models outside a shared scene scope get their own window materials');
firstStandalone.dispose();secondStandalone.dispose();

const daytime=new T.Scene(),nighttime=new T.Scene();
const dayGlass=createHouseGlass(T),nightGlass=createHouseGlass(T);
const model=createHouseModel(T,config,{glass:nightGlass});
const secondNightModel=createHouseModel(T,config,{glass:nightGlass});
const dayModel=createHouseModel(T,config,{glass:dayGlass});
nighttime.add(model.group,secondNightModel.group);daytime.add(dayModel.group);
const glass=[];
model.group.traverse(mesh=>{if(mesh.userData.glassPane)glass.push(mesh);});
assert(glass.length>=3);
assert(glass.every(mesh=>mesh.material.isMeshPhysicalMaterial),'Painted panes need glossy physical glass');
const originalMap=glass[0].material.map;
const nightEnvironment=new T.Texture();
nightGlass.setAppearance({gloss:93,reflection:75,night:true,glow:80,envMap:nightEnvironment});
const paneIn=model=>model.group.getObjectByProperty('material',nightGlass.material);
assert.ok(paneIn(secondNightModel),'Houses in one scene reuse its glass material');
assert.equal(dayGlass.material.map,originalMap,'The paint texture remains shared between scenes');
assert.equal(dayGlass.material.emissiveIntensity,.045);
assert.equal(dayGlass.material.envMap,null);
assert.equal(nightGlass.material.envMap,nightEnvironment);
assert.ok(dayModel.group.getObjectByProperty('material',dayGlass.material));
assert.equal(glass[0].material.clearcoat,.93);
assert(glass[0].material.emissiveIntensity>1);
assert.equal(glass[0].material.map,originalMap,'Gloss must preserve the gouache glass painting');

const a=createHouseAtmosphere(T,config,{detail:'high'});
const b=createHouseAtmosphere(T,config,{detail:'low'});
assert.equal(a.particles.length,4);
assert.equal(b.particles.length,2);
assert.equal(a.moss.material,b.moss.material,'Hundreds of houses must share the moss material');
assert(a.moss.geometry.index.count<=96,'Moss should be a compact, single draw-call wall shell');
assert(a.halos.length<=4);
const positions=a.moss.geometry.getAttribute('position');
const uv=a.moss.geometry.getAttribute('uv');
assert([...Array(uv.count).keys()].every(i=>uv.getY(i)<=.28001),
  'Gouache moss geometry must use the painted bottom quarter of the texture');
let foundationVisible=false;
for(let i=0;i<positions.count;i++){
  if([.183,.096,.054].some(offset=>Math.abs(positions.getZ(i)-(config.depth/2+offset))<.0001)){
    assert(Math.abs(positions.getX(i))>=1.18-.0001,'Moss must avoid the front door');
  }
  if(Math.abs(positions.getZ(i)-(config.depth/2+.183))<.0001&&positions.getY(i)<.4){
    foundationVisible=true;
  }
}
assert(foundationVisible,'Moss must project in front of the protruding foundation');
const chimney=houseChimneyOutlet(config);
assert(chimney.y>7&&chimney.x>0&&chimney.z<0);
a.setSettings({moss:true,mossHeight:145,mossDensity:90,night:true,
  smoke:true,smokeOutline:false,smokeDensity:60,windowGlow:75});
assert.equal(a.moss.geometry.getAttribute('position'),positions,
  'Changing moss height should update the same GPU vertex buffer');
assert.equal(a.moss.geometry.getAttribute('uv'),uv,
  'Changing moss height should preserve the texture buffer');
const grownPositions=a.moss.geometry.getAttribute('position');
assert(Math.abs(Math.max(...grownPositions.array.filter((_,i)=>i%3===1))-1.45)<1e-6,
  'Moss height must change while keeping the facade/foundation depth offsets');
assert(a.moss.material.opacity>.95,'Default gouache pigment must be legible');
assert.equal(a.glowGroup.visible,true);
assert.equal(a.smokeGroup.visible,true);
a.update(0);
const before=a.particles[0].sprite.position.y;
const firstScale=a.particles[0].sprite.scale.x;
assert(before<chimney.y,'Smoke should begin inside the chimney outlet');
assert(a.particles[0].sprite.material.opacity>.25,'First smoke puff must be visible at the chimney mouth');
assert(BUILDING_SMOKE_RISE>10&&BUILDING_SMOKE_RATE<.1,
  'Smoke should have a long, slow path above the roof');
assert(buildingSmokeFade(0)===1&&buildingSmokeFade(.95)>.2,
  'Smoke must appear immediately and fade gently near the end');
a.update(5);
assert(a.particles[0].sprite.position.y>before+3,'Smoke should rise well above the chimney');
assert(a.particles[0].sprite.scale.x>firstScale*3,'Smoke clouds should grow as they climb');
a.setNear(false);
assert.equal(a.smokeGroup.visible,false);
assert.equal(a.glowGroup.visible,false);
a.setNear(true);
assert.equal(a.glowGroup.visible,true);
const noChimney=createHouseAtmosphere(T,{...config,chimney:false});
assert.equal(noChimney.particles.length,0);
assert.equal(noChimney.smokeGroup.visible,false);
assert(createHouseMossGeometry(T,config).index.count<=96);
assert(loadBuildingAtmosphereSettings().smokeOutline);

for(const page of ['house-builder/index.html','landmark-lab/index.html','street-lab/index.html']){
  const html=await readFile(new URL(`../${page}`,import.meta.url),'utf8');
  for(const key of Object.keys(BUILDING_ATMOSPHERE_DEFAULTS)){
    if(key==='night'&&page==='street-lab/index.html'){
      assert(html.includes('id="nightMode"'),`${page}: night toggle missing`);
    }else assert(html.includes(`data-atmo="${key}"`),`${page}: ${key} control missing`);
  }
}
noChimney.dispose();a.dispose();b.dispose();
let nightDisposals=0;
nightGlass.material.addEventListener('dispose',()=>nightDisposals++);
model.dispose();
assert.equal(nightDisposals,0,'Disposing a house must preserve its scene glass');
secondNightModel.dispose();
nightGlass.dispose();
assert.equal(nightDisposals,1);
dayModel.dispose();dayGlass.dispose();nightEnvironment.dispose();
console.log('Ordinary homes: gouache moss, glass, smoke and night glow work with all shared controls and caches');
