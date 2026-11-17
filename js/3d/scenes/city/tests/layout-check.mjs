import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three-core.js';
import {createSky} from '../js/sky.js';

// Scene geometry can be checked without a browser, canvas or WebGL context.
const cityFile=resolve('js/city.js');
const source=readFileSync(cityFile,'utf8')
  .replace("from 'three'",`from "${pathToFileURL(resolve('vendor/three-core.js')).href}"`)
  .replace("from './world-data.js'",`from "${pathToFileURL(resolve('js/world-data.js')).href}"`)
  .replace("from './water.js'",`from "${pathToFileURL(resolve('js/water.js')).href}"`)
  .replace("from './terrain.js'",`from "${pathToFileURL(resolve('js/terrain.js')).href}"`)
  .replace("from './navigation/house-paths.js'",`from "${pathToFileURL(resolve('js/navigation/house-paths.js')).href}"`)
  .replace("from './buildings/house-model.js'",`from "${pathToFileURL(resolve('js/buildings/house-model.js')).href}"`)
  .replace("from './buildings/house-batch.js'",`from "${pathToFileURL(resolve('js/buildings/house-batch.js')).href}"`)
  .replace("from './buildings/house-materials.js'",`from "${pathToFileURL(resolve('js/buildings/house-materials.js')).href}"`)
  .replace("from './buildings/house-atmosphere.js'",`from "${pathToFileURL(resolve('js/buildings/house-atmosphere.js')).href}"`)
  .replace("from '../modules/house-builder/core/building-smoke-batch.js'",`from "${pathToFileURL(resolve('modules/house-builder/core/building-smoke-batch.js')).href}"`)
  .replace("from './city/city-house-lots.js'",`from "${pathToFileURL(resolve('js/city/city-house-lots.js')).href}"`)
  .replace("from './buildings/house-layout.js'",`from "${pathToFileURL(resolve('js/buildings/house-layout.js')).href}"`)
  .replace("from './landmarks/landmark-model.js'",`from "${pathToFileURL(resolve('js/landmarks/landmark-model.js')).href}"`)
  .replace("from './landmarks/landmark-atmosphere.js'",`from "${pathToFileURL(resolve('js/landmarks/landmark-atmosphere.js')).href}"`)
  .replace("from './street/district-profiles.js'",`from "${pathToFileURL(resolve('js/street/district-profiles.js')).href}"`)
  .replace('const occupiedLots=[];','const occupiedLots=globalThis.__keynlockTestLots=[];');
const {createCity}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const scene=new THREE.Scene(),materialCache=new Map();
const materials={get(key){
  if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial());
  return materialCache.get(key);
}};
const city=createCity({THREE,scene,materials});

const lots=globalThis.__keynlockTestLots;
const ships=scene.children.filter(obj=>obj.isGroup && /boat|ship/.test(obj.name));
const land=city.terrain;
const streets=scene.children.filter(obj=>obj.name==='city-merged-surface'&&obj.material===materials.get('road'));
const river=scene.children.find(obj=>obj.material?.isShaderMaterial&&obj!==city.water&&obj.material.uniforms?.normalSampler);
const smoke=scene.children.find(obj=>obj.name==='factory-smoke');
const instancedTriangles=city.hits.reduce((total,mesh)=>total+mesh.count*
  ((mesh.geometry.index?.count||mesh.geometry.getAttribute('position').count)/3),0);
const combinedSurfaces=scene.children.filter(obj=>obj.name==='city-merged-surface');
const distanceToSegment=(x,z,a,b)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
};
const distanceToPolyline=(x,z,points)=>Math.min(...points.slice(1).map((p,i)=>
  distanceToSegment(x,z,points[i],p)));
function segmentCrossing(a,b,c,d) {
  const ux=b[0]-a[0],uz=b[1]-a[1],vx=d[0]-c[0],vz=d[1]-c[1];
  const det=ux*vz-uz*vx;
  if(Math.abs(det)<1e-7)return null;
  const t=((c[0]-a[0])*vz-(c[1]-a[1])*vx)/det;
  const s=((c[0]-a[0])*uz-(c[1]-a[1])*ux)/det;
  return t>=0&&t<=1&&s>=0&&s<=1?[a[0]+ux*t,a[1]+uz*t]:null;
}
const riverCrossings=[];
city.roadNetwork.forEach((road,roadIndex)=>{
  for(let i=1;i<road.p.length;i++)for(let j=1;j<city.riverPoints.length;j++) {
    const p=segmentCrossing(road.p[i-1],road.p[i],city.riverPoints[j-1],city.riverPoints[j]);
    if(p)riverCrossings.push({roadIndex,point:p});
  }
});
const roadDeadEnds=[];
city.roadNetwork.forEach((road,index)=>{
  for(const point of [road.p[0],road.p[road.p.length-1]]){
    const [x,z]=point;
    const offMap=Math.abs(x)>115||z< -91;
    const neighbor=city.roadNetwork.some((other,j)=>j!==index&&distanceToPolyline(x,z,other.p)<2.8);
    // An open western quay ends intentionally at the river mouth.
    const quayTerminus=index===6&&Math.abs(x+27)<.1;
    if(!offMap&&!neighbor&&!quayTerminus)roadDeadEnds.push({index,point});
  }
});
console.log(`City layout: ${lots.length} houses, ${city.housePaths.length} garden paths, ${city.stairRuns.length} stair treads, ${city.surfaceStats.before} surfaces combined into ${combinedSurfaces.length} batches, ${ships.length} ships`);
console.log('Road endpoints without another route:',roadDeadEnds);
console.log('Actual river crossings:',riverCrossings);
console.log(`Scene batching: ${city.hits.length} instanced draws, ${Math.round(instancedTriangles).toLocaleString('en')} triangles`);
console.log('Houses by district:',Object.fromEntries([...new Set(lots.map(lot=>lot.style))].map(style=>[style,lots.filter(lot=>lot.style===style).length])));
assert.ok(lots.length>=60,'The rebuilt city needs enough separated houses to read as neighborhoods');
assert.equal(city.housePaths.length,lots.length,'Each occupied house must have a path to a public road');
const isRightAngle=(a,b)=>Math.abs(a[0]-b[0])<.0001||Math.abs(a[1]-b[1])<.0001;
for(const [index,road] of city.roadNetwork.entries()){
  if(index===6||index===7)continue; // The two quay walks trace the shoreline.
  for(let i=1;i<road.p.length;i++)assert.ok(isRightAngle(road.p[i-1],road.p[i]),
    `Public road ${index} must use straight, orthogonal paving`);
}
assert.ok(city.houseEntrances.every(({x,z})=>city.housePaths.some(route=>
  Math.hypot(route[0][0]-x,route[0][1]-z)<.0001)),
  'Every approach must tuck underneath its corresponding doorstep');
assert.ok(city.houseEntrances.filter(({lot})=>lot.style==='port')
  .every(({forward})=>Math.abs(forward[0])<.00001&&forward[1]>.99),
  'Every waterfront house must face its windows toward the sea');
for(const route of city.housePaths) {
  for(let i=1;i<route.length;i++)assert.ok(isRightAngle(route[i-1],route[i]),
    'Every front-door path must join the grid without diagonal shortcuts');
  const destination=route[route.length-1];
  assert.ok(city.roadNetwork.some(road=>distanceToPolyline(destination[0],destination[1],road.p)<.01),
    'A house path must finish on an actual street');
}
assert.equal(roadDeadEnds.length,0,'Every road should connect to another road or leave the map');
assert.equal(city.roadNetwork[4].p.length,2,'The uphill road should have no triangular dogleg');
assert.ok(city.roadNetwork[4].p.every(([x])=>x===-26),'The palace hillside lane should stay straight');
assert.equal(city.bridgeProfiles.length,3,'Only the three inland river bridges should remain');
assert.equal(riverCrossings.length,city.bridgeProfiles.length,
  'Every road crossing the river requires one of the three inland bridges');
for(const crossing of riverCrossings) {
  assert.ok(city.bridgeProfiles.some(bridge=>bridge.roadIndex===crossing.roadIndex&&
    Math.hypot(crossing.point[0]-bridge.x,crossing.point[1]-bridge.z)<3),
  'There must be no unbridged streets that accidentally ford the river');
}
assert.ok(!source.includes('bridgeGap'),'Roadways should continue across their own bridge decks without artificial gaps');
for(const bridge of city.bridgeProfiles) {
  const {x,z,length,width,heading,deckY,approach,roadIndex}=bridge;
  assert.ok(distanceToPolyline(x,z,city.riverPoints)<4.0,'A bridge must span the river channel');
  assert.ok(distanceToPolyline(x,z,city.roadNetwork[roadIndex].p)<.4,
    'Each bridge must lie precisely under its corresponding public road');
  assert.ok(length>width*2,'The bridge deck must reach both riverbanks');
  assert.ok(approach>=6,'The deck must use a gradual approach rather than short overlapping ramps');
  assert.ok(Math.abs(city.roadSurfaceHeight(x,z,.052)-deckY)<.001,
    'The bridge center should be a level continuation of the road surface');
  for(const side of [-1,1]){
    const run=side*(length/2+approach+.12);
    const px=x+run*Math.cos(heading),pz=z-run*Math.sin(heading);
    assert.ok(Math.abs(city.roadSurfaceHeight(px,pz,.052)-(city.terrainSurfaceHeight(px,pz)+.052))<.001,
      'The approach must meet the unmodified street with no height step');
    const edgeRun=side*length/2,ex=x+edgeRun*Math.cos(heading),ez=z-edgeRun*Math.sin(heading);
    assert.ok(Math.abs(city.roadSurfaceHeight(ex,ez,.052)-deckY)<.001,
      'The approach must meet the stone deck at its exact elevation');
    assert.ok(Math.abs(deckY-city.heightAt(px,pz)) / approach <.35,
      'Bridge approaches must not require unreasonable inclines');
  }
}
for(const lot of lots)for(const fx of [-1,-.5,0,.5,1])for(const fz of [-1,-.5,0,.5,1]) {
  assert.ok(distanceToPolyline(lot.x+lot.halfX*fx,lot.z+lot.halfZ*fz,city.riverPoints)>4.0,
    `A house in ${lot.style} overlaps the river`);
}
for(const [x,z,w,d] of city.factorySites) {
  const crossing=city.riverPoints.slice(1).flatMap(([bx,bz],i)=>{
    const [ax,az]=city.riverPoints[i];
    if(z<Math.min(az,bz)||z>Math.max(az,bz))return [];
    return [ax+(bx-ax)*(z-az)/(bz-az)];
  });
  assert.ok(crossing.some(riverX=>x+w/2<riverX-5),'Every factory must stand west of the river');
  for(const xx of [x-w/2,x,x+w/2])for(const zz of [z-d/2,z,z+d/2]) {
    const distance=distanceToPolyline(xx,zz,city.riverPoints);
    assert.ok(distance>4.0,`Factory foundations must stay on dry land: (${xx}, ${zz}), distance ${distance}`);
  }
}
assert.equal(streets.length,1,'Main streets, minor lanes, yards and house walks should use one paved material batch');
assert.ok(streets[0].geometry.index.count>900,'Merged stone roads must retain the full street grid');
const streetVertices=streets[0].geometry.getAttribute('position');
const streetUvs=streets[0].geometry.getAttribute('uv');
for(let i=0;i<streetVertices.count;i+=Math.max(1,Math.floor(streetVertices.count/72))) {
  assert.ok(Math.abs(streetUvs.getX(i)-streetVertices.getX(i)/2.35)<.00001&&
    Math.abs(streetUvs.getY(i)-streetVertices.getZ(i)/5.2)<.00001,
  'Paving must use one physically consistent world-space stone size even around house entrances');
}
assert.ok(scene.children.some(obj=>obj.material===materials.get('paving')),
  'Both riverfront and sea-facing promenades should have their own stone paving');
assert.ok(combinedSurfaces.length<=12,'Static road and garden surfaces should stay tightly batched');
assert.equal(city.surfaceStats.after,combinedSurfaces.length);
assert.ok(city.surfaceStats.before>city.surfaceStats.after*3,'Material merging should materially reduce draw calls');
assert.equal(ships.length,3,'All vessels should be grouped for animation');
assert.equal(land.name,'city-terrain','The town should use a deformable height-field mesh');
assert.ok(land.geometry.getAttribute('position').count>10000,'The land needs enough subdivisions for real relief');
assert.equal(scene.children.filter(object=>object.name==='city-terrain-edge').length,3,
  'Remove the continuous lower coastline skirt that appeared as a black strip in the sea');
const terrainX=land.geometry.getAttribute('position');
let west=Infinity,east=-Infinity;
let farNorth=Infinity;
for(let i=0;i<terrainX.count;i++){
  west=Math.min(west,terrainX.getX(i));east=Math.max(east,terrainX.getX(i));
  farNorth=Math.min(farNorth,terrainX.getZ(i));
}
assert.ok(west< -110&&east>110,'The land must extend naturally beyond both town edges');
assert.ok(farNorth< -91,'The hills and countryside should extend north of the palace');
const beachSurfaces=scene.children.filter(obj=>obj.material===materials.get('beach'));
assert.ok(beachSurfaces.length,'A sandy shore should border the grass outside the city');
for(const beach of beachSurfaces){
  const beachVertices=beach.geometry.getAttribute('position');
  for(let i=0;i<beachVertices.count;i++){
    assert.ok(Math.abs(beachVertices.getX(i))>56,
      'Sand must never overlap the stone-paved town waterfront');
  }
}
assert.ok(scene.children.some(obj=>obj.material===materials.get('wetSand')),'The waterfront needs a wet sand transition');
assert.ok(city.heightAt(5,-57)>13,'The relocated northern palace must crown an even higher plateau');
assert.ok(city.heightAt(5,-57)>=26.39,'The palace plateau must rise twice as high as before');
assert.ok(city.stairRuns.length>800,'Steep uphill roads should have frequent, shallow stone treads');
assert.ok(city.stairRuns.some(step=>step.grade>.4&&step.top>city.heightAt(step.x,step.z)),
  'The stair treads must stand above the slope they replace');
const stairRoad=streets[0].geometry,stairCoords=stairRoad.getAttribute('position'),stairIndices=stairRoad.index;
let uphillRoadFaces=0,clippedUphillFaces=0;
for(let i=0;i<stairIndices.count;i+=3){
  const a=stairIndices.getX(i),b=stairIndices.getX(i+1),c=stairIndices.getX(i+2);
  const x=(stairCoords.getX(a)+stairCoords.getX(b)+stairCoords.getX(c))/3;
  const z=(stairCoords.getZ(a)+stairCoords.getZ(b)+stairCoords.getZ(c))/3;
  if(z< -48||z> -32||x< -29||x>37)continue;
  const y=(stairCoords.getY(a)+stairCoords.getY(b)+stairCoords.getY(c))/3;
  uphillRoadFaces++;
  if(y<city.terrainSurfaceHeight(x,z)-.06)clippedUphillFaces++;
}
assert.ok(uphillRoadFaces>1000&&clippedUphillFaces/uphillRoadFaces<.015,
  'Uphill road ribbons must stay on top of the actual triangulated terrain');
assert.equal(scene.children.filter(object=>/^KEYNLOCK · (church|theater|museum|townhall|palace|tower) ·/.test(object.name)).length,6,
  'All six new landmark models must be mounted on the original geography');
assert.ok(scene.children.some(object=>object.name.startsWith('legacy-geography-detailed-')),
  'The old street lots must be populated with the detailed house models');
assert.ok(lots.filter(lot=>lot.style==='hill').length>=32,
  'The palace hillside should contain additional homes with blue roofs');
assert.ok(city.riverWidth(-80,-94)<city.riverWidth(-37,-32)-1.5,
  'The stream should gradually widen from the northern mountains into the town');
assert.ok(city.riverWidth(-80,-103)===0,'The river should not render a rectangular surface beyond the northern terrain');
assert.ok(city.riverWidth(-19,20)>city.riverWidth(-37,-32),
  'The estuary must broaden before joining the sea');
assert.equal(city.pierLayouts.filter(pier=>pier.kind==='cargo').length,2,
  'Two loading piers should have wider berth heads');
assert.equal(city.pierLayouts.filter(pier=>pier.kind==='fishing').length,2,
  'Two fishing piers should have a lighter shore canopy');
assert.ok(new Set(city.pierLayouts.map(pier=>pier.length)).size===4,
  'The waterfront should have piers of different lengths');
assert.ok(scene.children.some(mesh=>mesh.name.startsWith('legacy-geography-detailed-palace-')),
  'Detailed palace-district roof variants must appear in the original uphill lots');
assert.ok(city.heightAt(5,-57)>city.heightAt(5,-37)+1,'The palace must be farther and higher than its former site');
assert.ok(city.heightAt(32,-30)>1,'The upper district should have rolling hills');
for(const warehouse of city.waterfrontWarehouses){
  assert.notEqual(warehouse.x,42,'The red warehouse beside the eastern pier must be removed');
  for(const dx of [-warehouse.w/2,warehouse.w/2])for(const dz of [-warehouse.d/2,warehouse.d/2]){
    assert.ok(warehouse.bottom<city.heightAt(warehouse.x+dx,warehouse.z+dz)-.45,
      'A waterfront brick warehouse must have a stone foundation reaching downhill ground');
  }
}
assert.equal(city.fieldPlots.length,9,'The eastern countryside should contain nine cultivated fields');
assert.ok(city.fieldPlots.every(([x,z,w,d])=>x>60&&z<-39&&w>=10&&d>=9),
  'Farmland should occupy the upper-right countryside');
assert.ok(city.windmillRotor?.isGroup&&city.windmillRotor.name==='windmill-rotor',
  'The upper-right fields need a four-bladed windmill');
assert.equal(city.heightAt(-20,city.coast(-20)+2),0,'Terrain must descend to sea level');
assert.ok(city.heightAt(-19,city.coast(-19))<-.34,
  'The estuary floor must descend below the ocean surface');
assert.ok(city.riverSurfaceHeight(-37,-32)<city.heightAt(-44,-32),
  'The recessed river surface must lie below its raised dry banks');
assert.ok(city.riverSurfaceHeight(-29,-23)<city.heightAt(-36,-23),
  'The lowered river must stay below its embankments along the urban reach');
assert.ok(land.geometry.boundingBox===null||land.geometry.boundingBox.max.y>=0);
const roadMesh=scene.children.find(obj=>obj.material===materials.get('road')&&obj.geometry?.type==='BufferGeometry');
const roadHeights=[];
for(let i=0;i<roadMesh.geometry.getAttribute('position').count;i++)roadHeights.push(roadMesh.geometry.getAttribute('position').getY(i));
assert.ok(Math.max(...roadHeights)-Math.min(...roadHeights)>1,'Roads should follow the uneven ground');
const palace=scene.children.find(object=>object.name==='KEYNLOCK · palace · medium');
assert.ok(palace?.children.length>15,'The new palace must retain its detailed wings and towers');
assert.ok(Math.abs(palace.position.y-city.heightAt(palace.position.x,palace.position.z)-.15)<.01,
  'The new palace must be grounded on the old palace hill');
assert.ok(Math.abs(city.coast(-40)-city.coast(35))>1,'The coastline must curve');
assert.ok(city.water?.isWater,'The sea should use the original Three.js r187 reflective Water mesh');
const seabed=scene.children.find(obj=>obj.name==='city-sandy-seabed');
assert.ok(seabed?.isMesh&&seabed.geometry.getAttribute('position').count>8000,
  'A tessellated sandy seabed should be visible beneath the ocean');
assert.ok(seabed.geometry.getAttribute('normal').getY(0)>.3,'Seabed faces must point towards the water surface');
assert.ok(city.water.material.transparent&&!city.water.material.depthWrite,'Sea water must reveal the sand below');
assert.ok(city.water.material.uniforms.mirrorSampler.value?.isTexture,'The sea needs planar reflections');
assert.ok(city.water.material.uniforms.normalSampler.value?.isDataTexture,'The sea needs a normal map');
assert.strictEqual(river.material.uniforms.normalSampler.value,city.water.material.uniforms.normalSampler.value,
  'The river must share the ocean normal texture');
assert.ok(city.water.material.vertexShader.includes('wavePosition.z+='),'The ocean should have real vertex swells');
assert.ok(city.water.material.vertexShader.includes('float tide='),'Tides should lift the sea onto the beach and low pier decks');
assert.ok(city.water.material.fragmentShader.includes('foam*.6'),'Breaking surf should remain visible through transparent water');
const riverPositions=river.geometry.getAttribute('position');
let riverNorth=Infinity,riverSouth=-Infinity;
let submergedRiverVertices=0;
for(let i=0;i<riverPositions.count;i++){
  riverNorth=Math.min(riverNorth,riverPositions.getZ(i));riverSouth=Math.max(riverSouth,riverPositions.getZ(i));
  const x=riverPositions.getX(i),z=riverPositions.getZ(i);
  if(z<15){
    const delta=riverPositions.getY(i)-city.terrainSurfaceHeight(x,z);
    if(delta<-.08)submergedRiverVertices++;
  }
}
assert.ok(city.riverPoints.length>140,'The river should follow a densely sampled, smoothly curving centerline');
assert.ok(riverPositions.count>1500,'The water surface should be subdivided for soft curved banks');
assert.ok(submergedRiverVertices/riverPositions.count<.19,
  'The river must remain visible across most of its width without jagged terrain breakthrough');
assert.ok(river.material.fragmentShader.includes('softBank')&&river.material.fragmentShader.includes('float ripple='),
  'River shores should feather into the bank and water should show animated flow');
assert.ok(riverNorth< -86&&riverNorth> -101&&riverSouth>15&&riverSouth<city.coast(-19)+8,
  'The river should begin within the natural northern edge and reach the sea');
assert.ok(river.material.fragmentShader.includes('smoothstep(coast-9.0,coast+.2'),
  'River tint must fade completely before its ribbon enters the sea');
assert.ok(city.water.material.fragmentShader.includes('float surf1='),'The shoreline must show breaking waves');
assert.ok(!city.hits.some(mesh=>mesh.name==='city-foam'),'Obsolete dotted foam segments must be gone');
city.setWaterTime(5.5);
assert.equal(city.water.material.uniforms.time.value,5.5,'The sea must be animated');
assert.equal(river.material.uniforms.uTime.value,5.5,'River and sea should animate in sync');
city.setWaterView(new THREE.Vector3(14,33,47));
assert.equal(river.material.uniforms.uEye.value.x,14,'The river lighting should follow the camera');
city.setWaterLighting('night');
assert.equal(city.water.material.uniforms.uNight.value,1,'The sea should darken with the town at night');
assert.ok(city.nightLightSites.lamps.length>20&&city.nightLightSites.windows.length>30,
  'The city needs working street lamps and illuminated domestic windows');
const warmLights=scene.children.filter(object=>object.isPointLight);
const lightHalos=scene.children.filter(object=>object.isSprite);
assert.equal(warmLights.length,16,'Night lighting should pool sixteen low-cost warm point lights');
assert.equal(lightHalos.length,16,'Lamps and windows should get a visible soft halo');
assert.ok(warmLights.every(light=>!light.visible),'Daytime point lights must be disabled');
city.setNightLighting('night');city.updateNightLights({x:5,z:8});
assert.ok(warmLights.some(light=>light.visible&&light.intensity>1),
  'At night nearby windows and street lamps should actually light the scene');
assert.ok(lightHalos.some(sprite=>sprite.visible),'At night windows and lanterns should bloom softly');
city.setNightLighting('day');
assert.ok(warmLights.every(light=>!light.visible)&&lightHalos.every(sprite=>!sprite.visible),
  'Daytime should release expensive point-light shading');
assert.equal(smoke.count,15,'Factory chimney smoke must be batched into 15 moving instances');
const houseMoss=scene.children.filter(object=>object.name?.startsWith('city-gouache-house-moss-'));
const houseSmoke=scene.children.find(object=>object.name==='city-instanced-gouache-chimney-smoke');
assert(houseMoss.length>0&&houseMoss.every(object=>object.isInstancedMesh&&object.geometry.index.count<=96),
  'All districts need visible, instanced gouache moss on ordinary house foundations');
assert(houseSmoke?.isPoints&&houseSmoke.material.isShaderMaterial,
  'Ordinary chimney smoke should be one size-animated particle batch');
city.update(0);
const smallPuff=houseSmoke.geometry.getAttribute('puffSize').getX(0);
const firstPuffY=houseSmoke.geometry.getAttribute('position').getY(0);
city.update(2);
assert(houseSmoke.geometry.getAttribute('puffSize').getX(0)>smallPuff,
  'City chimney smoke must become larger as it rises');
assert(houseSmoke.geometry.getAttribute('position').getY(0)>firstPuffY+1,
  'City chimney smoke must rise visibly higher than the outlet');
assert.ok(instancedTriangles<200000,'The district detail should stay inside the geometry budget');
for(let i=0;i<lots.length;i++)for(let j=i+1;j<lots.length;j++){
  const a=lots[i],b=lots[j];
  assert.ok(Math.abs(a.x-b.x)>=a.halfX+b.halfX+.48 ||
    Math.abs(a.z-b.z)>=a.halfZ+b.halfZ+.48,'Two houses overlap');
}
const starts=ships.map(ship=>ship.position.clone());
const startingWindmillAngle=city.windmillRotor.rotation.z;
const beforeSmoke=new THREE.Matrix4(),afterSmoke=new THREE.Matrix4();
smoke.getMatrixAt(0,beforeSmoke);
city.update(8);
assert.ok(Math.abs(city.windmillRotor.rotation.z-startingWindmillAngle)>1,
  'The windmill sails should rotate while the scene runs');
assert.ok(ships.every((ship,index)=>ship.position.distanceTo(starts[index])>.2),
  'Ships should navigate and bob on the sea');
smoke.getMatrixAt(0,afterSmoke);
assert.ok(new THREE.Vector3().setFromMatrixPosition(beforeSmoke).distanceTo(
  new THREE.Vector3().setFromMatrixPosition(afterSmoke))>.2,'Smoke plumes should drift');
const camera=new THREE.PerspectiveCamera(),sky=createSky(THREE,scene,camera);
sky.setTime('night');sky.update();sky.dispose();
city.dispose();
delete globalThis.__keynlockTestLots;
