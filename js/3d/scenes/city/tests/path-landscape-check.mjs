import assert from 'node:assert/strict';
import {normalizeLandscape,createLandscapeSampler,nearestRiver,bridgeProfiles,bridgeAt,
  landscapeCellAllowed,landscapePlacementCheck,riverIntersectsBuildings,exampleLandscape,
  LANDSCAPE_BOUNDS,landscapeEraseTarget,sampleIndexedHillHeight} from '../js/path-builder/landscape-model.js';
import {planBuildingPaths} from '../js/navigation/path-layout.js';
import {simplifyRiverPoints} from '../js/path-builder/river-brush.js';

assert.deepEqual(LANDSCAPE_BOUNDS,{width:2640,depth:1800},
  'Game territory is 1.6 times smaller along both axes');

const scene=exampleLandscape(),bridge=bridgeProfiles(scene)[0];
assert.equal(scene.rivers.length,1);assert.equal(scene.hills.length,2);assert.equal(scene.bridges.length,1);
assert.ok(bridge.span>scene.rivers[0].width+4,'Bridge grows with river width');
const sampler=createLandscapeSampler(scene);
assert.ok(sampler.heightAt(-43,28)>2.2,'Hills deform the 3D ground near the remapped Neva bank');
assert.ok(sampler.heightAt(bridge.x,bridge.z)<-.5,'River channel lies below water');
assert.ok(sampler.roadHeightAt(bridge.x,bridge.z)>.5,'Bridge paving rises above water');
assert.equal(landscapeCellAllowed(scene,bridge.x,bridge.z),true,'Bridge provides a passable crossing');
const near=nearestRiver(scene,bridge.x,bridge.z);
assert.ok(near.distance<.1);
assert.ok(bridgeAt(scene,bridge.x,bridge.z));
const bridgeEnd={x:bridge.x+bridge.dirX*(bridge.span/2-1),
  z:bridge.z+bridge.dirZ*(bridge.span/2-1)};
assert.equal(landscapeEraseTarget(scene,bridgeEnd.x,bridgeEnd.z)?.type,'bridge',
  'Deleting a bridge near either bank must never select the river');
const riverOnly=normalizeLandscape({...scene,bridges:[]});
assert.equal(landscapeCellAllowed(riverOnly,bridge.x,bridge.z),false,'Unbridged channel is impassable');
assert.equal(landscapePlacementCheck(scene,{x:bridge.x,z:bridge.z,width:8,depth:7,rotation:0}).valid,false);

const house={id:'hill-house',x:-43,z:28,width:7,depth:6,rotation:0};
const pad=createLandscapeSampler(scene,[house]);
assert.ok(Math.abs(pad.heightAt(-46,25)-pad.heightAt(-40,31))<.001,
  'One house foundation stays level across a sloping site');
assert.ok(pad.heightAt(-43,28)>2.5);
assert.ok(riverIntersectsBuildings(scene,{width:7,points:[[-43,24],[-43,32]]},[house]));
const centralHouse={id:'collision',x:0,z:0,width:10,depth:10,rotation:0};
assert.equal(riverIntersectsBuildings(scene,{width:7,points:[[-100,0],[100,0]]},[centralHouse]),true,
  'A long stroke crosses a building even if both endpoints are far away');
assert.equal(riverIntersectsBuildings(scene,{width:7,points:[[-100,9.5],[100,9.5]]},[centralHouse]),true,
  'A riverbank may touch a foundation without its centreline crossing it');
assert.equal(riverIntersectsBuildings(scene,{width:7,points:[[-100,9.7],[100,9.7]]},[centralHouse]),false,
  'A river beyond the rounded bank clearance leaves the building untouched');
assert.equal(riverIntersectsBuildings(scene,{width:5,points:[[0,0],[100,100]]},
  [{...centralHouse,x:50,z:50,rotation:Math.PI/4}]),true,
  'Collision tests respect rotated building footprints');
const deep=normalizeLandscape({rivers:[{id:'deep',width:16,depth:6.5,
  points:[[-65,-100],[-65,100]]}]});
const bed=createLandscapeSampler(deep);
const fixedNeva=createLandscapeSampler(normalizeLandscape());
assert.ok(bed.heightAt(-65,0)<-6,'Wide river has a deeply excavated bed');
assert.ok(bed.heightAt(-55,0)<0&&bed.heightAt(-55,0)>-1.1,
  'Deepened riverbanks still transition gradually into dry ground');
assert.ok(Math.abs(bed.heightAt(-53,0)-fixedNeva.heightAt(-53,0))<.01,
  'Editable banks meet the permanent Neva terrain outside their channel');
assert.equal(deep.rivers[0].depth,6.5);
const confluence=normalizeLandscape({rivers:[
  {id:'narrow',width:4,depth:1,points:[[-30,0],[30,0]]},
  {id:'wide',width:20,depth:6,points:[[0,-30],[0,30]]},
]});
const joinedBed=createLandscapeSampler(confluence);
assert.ok(joinedBed.plainHeight(1,0)<-5,
  'At junctions, carve the deepest intersecting channel even nearer another centreline');
assert.equal(landscapeCellAllowed(confluence,6,3),false,
  'The union of river widths must remain impassable, including overlap edges');
assert.equal(landscapePlacementCheck(confluence,{x:6,z:3,width:1,depth:1}).valid,false,
  'Building placement also respects the union of all channels');
assert.ok(Math.abs(joinedBed.plainHeight(24,24)-fixedNeva.plainHeight(24,24))<.01,
  'Both channels meet the permanent terrain without spurious banks outside their union');

const manyHills=normalizeLandscape({hills:Array.from({length:300},(_,i)=>
  ({id:`h${i}`,x:-240+i%30*16,z:-150+Math.floor(i/30)*30,radius:12,height:2}))});
assert.equal(manyHills.hills.length,300,'Terrain editing handles hundreds of distinct hills');
assert.ok(sampleIndexedHillHeight(manyHills,-240,-150)>.5,
  'Hill stamp is preserved even when a mapped Neva channel occupies the site');
const riverStroke=Array.from({length:1000},(_,i)=>[i*.2-100,Math.sin(i/16)*2]);
const simplified=simplifyRiverPoints(riverStroke,.6);
assert.deepEqual(simplified.at(-1),riverStroke.at(-1),'Long brush strokes retain the far endpoint');
assert.ok(simplified.length<riverStroke.length/5,
  'Editable river centerlines do not require a geometric ribbon per stroke');

const houses=[
  {id:'west',kind:'house',x:-35,z:0,width:8,depth:7,rotation:0},
  {id:'east',kind:'house',x:36,z:0,width:8,depth:7,rotation:Math.PI},
];
const crossingLandscape=normalizeLandscape({...scene,rivers:[{...scene.rivers[0],
  points:[[0,-LANDSCAPE_BOUNDS.depth/2+1],[0,LANDSCAPE_BOUNDS.depth/2-1]]}],
  bridges:[{id:'crossing',riverId:'example-river',t:.5}]});
const crossingRemoved=normalizeLandscape({...crossingLandscape,bridges:[]});
const layout=planBuildingPaths(houses,{landscape:crossingLandscape});
assert.equal(layout.connected,2,'The path planner connects buildings across the river');
assert.equal(layout.paths.length,1);
const blocked=planBuildingPaths(houses,{landscape:crossingRemoved});
assert.equal(blocked.paths.length,0,'A river without a crossing separates both banks');
let crossed=false;
for(const path of layout.paths)for(let i=1;i<path.p.length;i++){
  const a=path.p[i-1],b=path.p[i];
  const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*4);
  for(let k=0;k<=n;k++){
    const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n;
    const r=nearestRiver(crossingLandscape,x,z);
    if(r&&r.distance<r.river.width/2-.65){
      crossed=true;assert.ok(bridgeAt(crossingLandscape,x,z),'Paving may cross open water only on a stone bridge');
    }
  }
}
assert.ok(crossed,'The network visibly crosses the river');
console.log('Landscape: rivers, hill foundations and bridge-only pathfinding OK');
