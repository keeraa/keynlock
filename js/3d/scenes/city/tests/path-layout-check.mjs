import assert from 'node:assert/strict';
import {PATH_BOUNDS,buildingEntrance,buildingFootprint,planBuildingPaths,validateBuildingPlacement} from '../js/navigation/path-layout.js';

const houses=[
  {id:'house-1',kind:'house',x:-25,z:9,width:8,depth:7,rotation:0},
  {id:'house-2',kind:'house',x:-3,z:17,width:9,depth:7,rotation:Math.PI/2},
  {id:'house-3',kind:'house',x:27,z:-5,width:8,depth:7,rotation:Math.PI},
  {id:'landmark-church',kind:'landmark',x:2,z:-22,width:12,depth:17,rotation:0,
    pathAccess:{x:0,z:10}},
];
assert.equal(planBuildingPaths(houses.slice(0,1)).paths.length,0);
assert.equal(planBuildingPaths(houses.slice(0,2)).paths.length,1);
const layout=planBuildingPaths(houses);
assert.equal(layout.paths.length,3);
assert.equal(layout.anchors.length,houses.length);
assert.equal(layout.connected,houses.length);
assert.ok(layout.paths.some(path=>path.pavingType==='walk'));
assert.ok(layout.paths.some(path=>path.pavingType==='street'));
assert.equal(layout.plazas.length,1,'Every unobstructed landmark needs a front plaza');
assert.ok(layout.length>30);
assert.ok(layout.network.nodes.length>=4);
for(const building of houses){
  const entrance=buildingEntrance(building);
  const route=layout.network.findRoute('house-1',building.id);
  assert.ok(route,`Missing pedestrian route to ${building.id}`);
  assert.ok(Math.hypot(route.at(-1)[0]-entrance.x,route.at(-1)[1]-entrance.z)<.001);
}
for(const path of layout.paths)for(let i=1;i<path.p.length;i++){
  const a=path.p[i-1],b=path.p[i];
  assert.ok(Math.abs(a[0]-b[0])<.001||Math.abs(a[1]-b[1])<.001,
    `Diagonal path in ${path.id}: ${a} -> ${b}`);
  // Exclude endpoints of a building's doorstep segment; all other paving
  // must stay outside each building's physical footprint.
  for(let t=.05;t<.96;t+=.1){
    const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    for(const building of houses){
      const lot=buildingFootprint(building);
      assert.ok(Math.abs(x-lot.x)>lot.halfX-.08||Math.abs(z-lot.z)>lot.halfZ-.08,
        `Path ${path.id} intersects ${building.id} at (${x},${z})`);
    }
  }
}
const moved=houses.map(b=>b.id==='house-3'?{...b,x:36,z:8}:b);
assert.ok(validateBuildingPlacement(moved[2],moved).valid);
const altered=planBuildingPaths(moved);
assert.equal(altered.connected,moved.length);
assert.notDeepEqual(altered.paths,layout.paths,'Paths must react to moving a house');
const deleted=planBuildingPaths(houses.filter(b=>b.id!=='house-2'));
assert.equal(deleted.paths.length,2);
assert.equal(deleted.connected,3);
assert.equal(validateBuildingPlacement({...houses[1],x:-24,z:8},houses).valid,false);
assert.equal(validateBuildingPlacement({...houses[1],x:PATH_BOUNDS.maxX+5,z:8},houses).valid,false);
const rotated=buildingEntrance({...houses[1],rotation:Math.PI/2});
assert.ok(rotated.x>houses[1].x&&Math.abs(rotated.z-houses[1].z)<.001,
  'Doorway direction must rotate along with the building');
const dense=[];
for(let i=0;i<5;i++)for(let j=0;j<5;j++)dense.push({
  id:`dense-${i}-${j}`,kind:'house',x:-48+j*24,z:-32+i*16,
  width:8,depth:7,rotation:0,
});
const denseLayout=planBuildingPaths(dense);
assert.equal(denseLayout.paths.length,dense.length-1,'Dense plans need a connected tree without duplicate branches');
assert.equal(denseLayout.connected,dense.length,'Large layouts must remain fully traversable');
console.log(`Path laboratory: ${layout.paths.length} routes, ${layout.junctions} junctions, ${Math.round(layout.length)} m, all buildings connected`);
