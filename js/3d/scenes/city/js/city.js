import * as THREE from 'three';
import { DISTRICTS, LOCATIONS } from './world-data.js';
import { createWaterMaterials } from './water.js';
import { makeHeightSampler, createTerrainMeshes, northTerrainEdge } from './terrain.js';
import { connectHousePaths } from './navigation/house-paths.js';
import { createHouseModel } from './buildings/house-model.js';
import { batchHouseGeometry } from './buildings/house-batch.js';
import {setHouseGlassAppearance} from './buildings/house-materials.js';
import {acquireHouseAtmosphereResources,createHouseMossGeometry,setHouseMossGeometryHeight,houseChimneyOutlet,loadBuildingAtmosphereSettings} from './buildings/house-atmosphere.js';
import {createBuildingSmokeBatch} from '../modules/house-builder/core/building-smoke-batch.js';
import {populateCityHouseLots} from './city/city-house-lots.js';
import {windowLayout} from './buildings/house-layout.js';
import { createLandmarkModel } from './landmarks/landmark-model.js';
import {createLandmarkAtmosphere} from './landmarks/landmark-atmosphere.js';
import { DISTRICT_PROFILES } from './street/district-profiles.js';

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
  const newHousePlacements=new Map();
  const waterfrontWarehouses=[];
  const smokePuffs=[];
  const windowLightSites=[];
  const houseAtmosphereResources=acquireHouseAtmosphereResources(T);
  let buildingSettings=loadBuildingAtmosphereSettings(),buildingGlassEnvironment=null;
  const cityMossBatches=[],cityHouseModels=[],cityLandmarkModels=[],citySmokeParticles=[];
  let cityHouseSmoke=null,cityHouseSmokeBatch=null;
  const streetLampSites=[];
  const stairRuns=[];
  const palaceEntrySteps=[];
  const palaceWindowPanes=[];
  let windmillRotor=null;
  let smokeBatch=null;
  const effectMaterials=[];
  const geometries={
    box:new T.BoxGeometry(1,1,1),
    cylinder:new T.CylinderGeometry(1,1,1,9),
    tower:new T.CylinderGeometry(.78,1.02,1,8),
    cone:new T.ConeGeometry(1,1,8),
    dome:new T.SphereGeometry(1,10,7),
    crown:new T.IcosahedronGeometry(1,1),
  };
  const yawQ=new T.Quaternion(),tiltQ=new T.Quaternion(),q=new T.Quaternion();
  const smokePosition=new T.Vector3(),smokeScale=new T.Vector3(),smokeRotation=new T.Quaternion(),smokeMatrix=new T.Matrix4();
  const up=new T.Vector3(0,1,0),forward=new T.Vector3(0,0,1),right=new T.Vector3(1,0,0);
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
  let riverSurfaceHeight=null;
  let terrain;
  let terrainSurfaceAt=heightAt;

  function smoothEase(a,b,value) {
    const t=clamp((value-a)/(b-a),0,1);
    return t*t*(3-2*t);
  }

  function part(material,shape,x,y,z,sx,sy,sz,yaw=0,tilt=0,roll=0,ground=null) {
    const key=shape+'/'+material;
    if(!batches.has(key))batches.set(key,{shape,material,entries:[]});
    const entry=batches.get(key);
    yawQ.setFromAxisAngle(up,yaw);tiltQ.setFromAxisAngle(forward,tilt);
    q.copy(yawQ).multiply(tiltQ);
    if(roll)q.multiply(new T.Quaternion().setFromAxisAngle(right,roll));
    const matrix=new T.Matrix4().compose(new T.Vector3(x,y+(ground??heightAt(x,z)),z),q,new T.Vector3(sx,sy,sz));
    entry.entries.push(matrix);
  }
  function local(x,z,dx,dz,angle) {return [x+dx*Math.cos(angle)+dz*Math.sin(angle),z-dx*Math.sin(angle)+dz*Math.cos(angle)];}
  function collectSurface(geometry,material) {
    if(!surfaces.has(material))surfaces.set(material,[]);
    surfaces.get(material).push(geometry);
  }
  function ribbon(points,width,material,y,options={}) {
    const positions=[],uvs=[],index=[];
    const stonePattern=['road','cobble','paving','quay','stonePath'].includes(material);
    // Paved edges are straight. Their former random widths and averaged corner
    // normals made jagged wedges wherever two streets joined.
    const rough=stonePattern?0:(options.rough||0);
    const direction=(a,b)=>{
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
      return [-dz/length,dx/length];
    };
    const samples=[];
    if(points.length<2)return;
    samples.push({point:points[0],length:0,normal:direction(points[0],points[1])});
    let walked=0;
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1],[bx,bz]=points[i];
      const length=Math.hypot(bx-ax,bz-az);
      const steps=Math.max(1,Math.ceil(length/(stonePattern?.44:.75)));
      const normal=direction(points[i-1],points[i]);
      for(let j=1;j<=steps;j++){
        let cornerNormal=normal;
        if(j===steps&&i<points.length-1){
          const next=direction(points[i],points[i+1]);
          const dot=normal[0]*next[0]+normal[1]*next[1];
          const divisor=Math.max(.5,1+dot);
          cornerNormal=[(normal[0]+next[0])/divisor,(normal[1]+next[1])/divisor];
        }
        samples.push({point:[ax+(bx-ax)*j/steps,az+(bz-az)*j/steps],
          length:walked+length*j/steps,normal:cornerNormal});
      }
      walked+=length;
    }
    const across=options.crossSections??(stonePattern?Math.max(2,Math.ceil(width/.65)):1);
    for(let i=0;i<samples.length;i++) {
      const [nx,nz]=samples[i].normal;
      const [x,z]=samples[i].point;
      const actualWidth=options.widthAt?options.widthAt(x,z,samples[i].length/walked):width;
      const edge=actualWidth/2*(1+Math.sin(i*2.7)*rough);
      for(let j=0;j<=across;j++) {
        const side=1-2*j/across;
        const shift=options.centerOffsetAt?options.centerOffsetAt(x,z,samples[i].length/walked):0;
        const px=x+nx*(edge*side+shift),pz=z+nz*(edge*side+shift);
        const elevation=options.elevation?options.elevation(px,pz):y+(options.flat?0:terrainSurfaceAt(px,pz));
        positions.push(px,elevation,pz);
        // Paving uses one world-space stone course size on every lane.
        if(stonePattern)uvs.push(px/2.35,pz/5.2);
        else uvs.push(j/across,samples[i].length/5);
        if(i&&j<across){
          const a=(i-1)*(across+1)+j,b=i*(across+1)+j;
          index.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(index);geometry.computeVertexNormals();
    collectSurface(geometry,typeof material==='string'?materials.get(material):material);
  }
  function pavedRectangle(x,z,w,d,y=.049,material='road'){
    ribbon([[x-w/2,z],[x+w/2,z]],d,material,y);
  }
  function foundationDepth(x,z,halfX,halfZ){
    const center=heightAt(x,z);
    let lowest=center;
    for(const dx of [-halfX,0,halfX])for(const dz of [-halfZ,0,halfZ]){
      lowest=Math.min(lowest,heightAt(x+dx,z+dz));
    }
    // The stone plinth must reach the actual downhill surface at every corner.
    return Math.max(1.3,center-lowest+.65);
  }
  function landAndSea() {
    const waterMats=createWaterMaterials(T);
    // A continuous pale sand shelf descends under turquoise shallows to cooler deep dunes.
    const bedX=148,bedZ=100,bedPositions=[],bedUvs=[],bedIndices=[];
    for(let iz=0;iz<=bedZ;iz++)for(let ix=0;ix<=bedX;ix++) {
      const x=-305+610*ix/bedX,t=iz/bedZ;
      const start=coast(x)-7,z=start+(615-start)*Math.pow(t,1.65);
      const depth=clamp((z-coast(x)+3)/148,0,1);
      const ripples=(.095*Math.sin(x*.34+z*.21)+.065*Math.sin(z*.47-x*.13))*Math.min(1,depth*8);
      const dune=.26*Math.sin(x*.065+z*.11)*depth;
      bedPositions.push(x,-.84-13.3*Math.pow(depth,1.2)+ripples+dune,z);
      bedUvs.push(x,z);
      if(ix&&iz){const a=iz*(bedX+1)+ix,b=a-1,c=a-bedX-1,d=c-1;bedIndices.push(a,c,b,b,c,d);}
    }
    const bedGeometry=new T.BufferGeometry();
    bedGeometry.setAttribute('position',new T.Float32BufferAttribute(bedPositions,3));
    bedGeometry.setAttribute('uv',new T.Float32BufferAttribute(bedUvs,2));
    bedGeometry.setIndex(bedIndices);bedGeometry.computeVertexNormals();
    const seabed=new T.Mesh(bedGeometry,materials.get('seabed'));
    seabed.name='city-sandy-seabed';seabed.receiveShadow=true;
    scene.add(seabed);objects.push(seabed);
    // The sea starts beneath the shoreline and extends beyond every camera pan.
    const seaGeometry=new T.PlaneGeometry(600,600,116,116);
    const sea=waterMats.createSea(seaGeometry);
    sea.rotation.x=-Math.PI/2;sea.position.set(0,-.34,312);
    scene.add(sea);objects.push(sea);
    const ground=createTerrainMeshes(T,materials.get('land'),coast,heightAt);
    terrainSurfaceAt=ground.surfaceHeightAt;
    terrain=ground.land;scene.add(terrain);objects.push(terrain);
    for(const edge of ground.skirts){scene.add(edge);objects.push(edge);}
    const westernBeach=[],easternBeach=[],westernWetSand=[],easternWetSand=[];
    const westernQuay=[],easternQuay=[];
    for(let x=-113;x<=113;x+=.8){
      if(x< -59.5){
        westernBeach.push([x,coast(x)-2.45]);
        westernWetSand.push([x,coast(x)-.85]);
      }else if(x>59.5){
        easternBeach.push([x,coast(x)-2.45]);
        easternWetSand.push([x,coast(x)-.85]);
      }
      if(x>=-60&&x< -25)westernQuay.push([x,coast(x)-2.35]);
      if(x> -15.5&&x<=60)easternQuay.push([x,coast(x)-2.35]);
    }
    // Wild coast stays sandy. Across the town, the paved apron owns the whole
    // waterfront footprint: no sand polygon can overdraw its inland edge.
    ribbon(westernBeach,5.35,'beach',.027,{rough:.035});
    ribbon(easternBeach,5.35,'beach',.027,{rough:.035});
    ribbon(westernWetSand,1.65,'wetSand',.036,{rough:.02});
    ribbon(easternWetSand,1.65,'wetSand',.036,{rough:.02});
    // The bridge crosses a real open estuary; paving and retaining walls
    // end at either riverbank instead of forming a hidden dam under its deck.
    ribbon(westernQuay,5.55,'paving',.12,{rough:.005});
    ribbon(easternQuay,5.55,'paving',.12,{rough:.005});
    for(let x=-59;x<=59;x+=2.1) {
      if(x> -25&&x< -15.5)continue;
      const slope=(coast(x+1)-coast(x-1))/2;
      part('quay','box',x,-.42,coast(x)-.3,2.24,1.10,.88,-Math.atan(slope));
      part('stone','box',x,.13,coast(x)-.55,2.23,.14,.35,-Math.atan(slope));
    }
    return waterMats;
  }

  // Streets use a rectilinear town grid. The old meandering centerlines
  // produced diagonal paver wedges, especially at the bridge approaches.
  // Only the coastal walkways follow the actual curved shoreline.
  const mainRoads=[
    {w:3.1,p:[[5,coast(5)-1.65],[5,-101]]},
    {w:2.1,p:[[-119,9.07],[119,9.07]]},
    {w:2.0,p:[[-119,-12.1],[119,-12.1]]},
    {w:2.3,p:[[-119,-28.7],[119,-28.7]]},
    // The eastern-bank road runs straight uphill from the bridge landing.
    // The former dogleg made a large, triangular paved spur on the castle hill.
    {w:1.7,p:[[-26,-28.7],[-26,-101]]},
    {w:1.7,p:[[35,coast(35)-1.65],[35,-101]]},
  ];
  const westPromenade={w:2.15,p:[]},eastPromenade={w:2.15,p:[]};
  for(let x=-120;x<=120;x+=3){
    if(x<=-27)westPromenade.p.push([x,coast(x)-1.65]);
    if(x>=-12)eastPromenade.p.push([x,coast(x)-1.65]);
  }
  // Both quay walks stop on dry ground. The estuary remains open to the sea.
  mainRoads.push(westPromenade,eastPromenade);
  // No diagonal shortcuts: right-angle junctions preserve the stone courses.
  const minorRoads=[
    {w:1.35,p:[[-86,coast(-86)-1.65],[-86,-101]]},
    {w:1.3,p:[[-13,coast(-13)-1.65],[-13,-28.7]]},
    {w:1.35,p:[[16,coast(16)-1.65],[16,-28.7]]},
    {w:1.35,p:[[50,coast(50)-1.65],[50,-62],[35,-62]]},
    {w:1.2,p:[[-52,-12.1],[-52,-3],[-43,-3]]},
    {w:1.25,p:[[16,-5],[50,-5]]},
    {w:1.25,p:[[16,-22],[50,-22]]},
    {w:1.5,p:[[-60,9.07],[-60,coast(-60)-1.65]]},
    {w:1.5,p:[[-13,9.07],[-13,14],[50,14]]},
    // Two factory-housing loops remain on the western bank.
    {w:1.5,p:[[-86,-28.7],[-86,-49],[-68,-49],[-68,-45],[-86,-45]]},
    {w:1.25,p:[[-86,-60],[-78,-60],[-78,-78],[-86,-78]]},
    // Keep the new hill frontage clear of the obsolete eastern service loop.
    {w:1.55,p:[[-43,coast(-43)-1.65],[-43,-28.7]]},
  ];
  // Three inland crossings link the districts. The former fourth bridge
  // obstructed the river mouth, and has been removed entirely.
  const bridges=[[-35.8,-28.7,15,2.8,3],[-24,-12.1,14,2.65,2],
    [-22.5,9.07,14,2.65,1]];
  // Keep the entire works and their workers' settlement on the western bank.
  const factorySites=[[-95,-40,11,6,4.4],[-104,-22,8,6,3.4],[-91,-22,7,6,3.2]];
  const fieldPlots=[[66,-63,16,12,'grain'],[88,-65,18,14,'crops'],
    [68,-82,16,10,'crops'],[95,-83,18,11,'grain'],
    [65,-45,14,9,'grain'],[84,-45,14,9,'crops'],[105,-45,14,9,'grain'],
    [108,-65,12,11,'crops'],[111,-83,10,9,'grain']];
  const pierLayouts=[
    {x:-39,length:11.1,width:3.2,kind:'cargo'},
    {x:-12,length:8.1,width:2.15,kind:'fishing'},
    {x:29,length:13.4,width:3.3,kind:'cargo'},
    {x:48,length:7.9,width:2.0,kind:'fishing'},
  ];
  const farmAccess=[[35,-82],[52,-82],[52,-74],[119,-74]];
  const upperFarmAccess=[[52,-54],[119,-54]];
  function atPolyline(x,z,points) {
    let best=Infinity;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
      best=Math.min(best,Math.hypot(x-(a[0]+dx*t),z-(a[1]+dz*t)));
    }
    return best;
  }
  const reserved=[
    ...factorySites.map(([x,z,w,d])=>[x,z,Math.max(w,d)*.72]),
    [93,-33,5.8],
    // Each characterful neighborhood gets a legible civic landmark and space
    // around it; random houses must never swallow these focal points.
    [-42,-2,8.2],[43,-40,6.3],[-35,-6,7.8],[42,-32,7.8],
    [30,0,7],[23,0,2.4],[41,0,2.4],[5,-57,20],[-1,-4,5],[24,-24,6],[-12,15,5],[45,15,6],
    [-34,16,6.5],[18,15,6.5],
    ...fieldPlots.map(([x,z,w,d])=>[x,z,Math.max(w,d)*.73]),
  ];
  function isBuildable(x,z,clearance=2) {
    if(x<ROOT_COORDINATES.minX+1||x>ROOT_COORDINATES.maxX-1||z<ROOT_COORDINATES.minZ+1||z>coast(x)-1.2)return false;
    if(atPolyline(x,z,riverPoints)<5.15+clearance*.3)return false;
    if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+clearance))return false;
    if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+clearance))return false;
    if(bridgeProfiles.some(bridge=>{
      const dx=x-bridge.x,dz=z-bridge.z;
      const along=dx*Math.cos(bridge.heading)-dz*Math.sin(bridge.heading);
      const across=dx*Math.sin(bridge.heading)+dz*Math.cos(bridge.heading);
      return Math.abs(along)<bridge.length/2+1.4&&Math.abs(across)<bridge.width/2+.85;
    }))return false;
    if(reserved.some(([rx,rz,r])=>Math.hypot(x-rx,z-rz)<r+clearance*.25))return false;
    return true;
  }
  const smoothstep=(a,b,value)=>{
    const t=clamp((value-a)/(b-a),0,1);
    return t*t*(3-2*t);
  };
  const bridgeProfiles=bridges.map(([x,z,length,width,roadIndex])=>{
    const points=mainRoads[roadIndex].p;
    let distance=Infinity,heading=0;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
      const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
      if(d<distance){distance=d;heading=-Math.atan2(dz,dx);}
    }
    const left=local(x,z,-length/2,0,heading),right=local(x,z,length/2,0,heading);
    const deckY=Math.max(heightAt(...left),heightAt(...right),heightAt(x,z))+.20;
    return {x,z,length,width,roadIndex,heading,deckY,
      approach:roadIndex===2?10:roadIndex===3?9:roadIndex===1?7.5:6.5};
  });
  // Each road is one continuous mesh across its bridge and both eased slopes.
  // Nearby junctions also climb gently to meet the raised deck at equal height.
  function pavedRoadHeight(x,z,offset) {
    const ground=terrainSurfaceAt(x,z)+offset;
    let height=ground;
    for(const bridge of bridgeProfiles) {
      const dx=x-bridge.x,dz=z-bridge.z;
      const along=dx*Math.cos(bridge.heading)-dz*Math.sin(bridge.heading);
      const across=dx*Math.sin(bridge.heading)+dz*Math.cos(bridge.heading);
      const run=1-smoothstep(bridge.length/2,bridge.length/2+bridge.approach,Math.abs(along));
      if(run<=0)continue;
      const side=1-smoothstep(bridge.width/2+.25,bridge.width/2+5.5,Math.abs(across));
      if(side<=0)continue;
      const deckSurface=bridge.deckY+offset-.052;
      height=Math.max(height,ground+(deckSurface-ground)*run*side);
    }
    return height;
  }
  function roadStairs(points,width,offset) {
    const treadPositions=[],treadUvs=[],treadIndices=[];
    const riserPositions=[],riserUvs=[],riserIndices=[];
    const putQuad=(positions,uvs,indices,corners)=>{
      const start=positions.length/3;
      for(const [x,y,z] of corners){positions.push(x,y,z);uvs.push(x/2.35,z/5.2);}
      indices.push(start,start+2,start+1,start+1,start+2,start+3);
    };
    for(let segment=1;segment<points.length;segment++){
      const [ax,az]=points[segment-1],[bx,bz]=points[segment];
      const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
      if(length<2)continue;
      const alongX=dx/length,alongZ=dz/length,nx=-alongZ,nz=alongX;
      // Frequent, shallow treads remain legible from the isometric camera.
      const stepCount=Math.ceil(length/.265),stride=length/stepCount;
      const sites=Array.from({length:stepCount+1},(_,i)=>{
        const t=i/stepCount,x=ax+dx*t,z=az+dz*t;
        return {x,z,height:pavedRoadHeight(x,z,offset)};
      });
      let previousTop=null,previousActive=false;
      for(let i=0;i<stepCount;i++){
        const a=sites[i],b=sites[i+1],before=sites[Math.max(0,i-2)],after=sites[Math.min(stepCount,i+3)];
        const span=Math.min(stepCount,i+3)-Math.max(0,i-2);
        const grade=Math.abs(after.height-before.height)/Math.max(stride,span*stride);
        const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
        const approachingBridge=bridgeProfiles.some(bridge=>
          Math.hypot(x-bridge.x,z-bridge.z)<bridge.length/2+bridge.approach+3);
        // A dedicated, hand-built stairway finishes the final castle approach.
        // Avoid overlaying a second set of road risers on its stone steps.
        const castleApproach=Math.abs(x-5)<3.4&&z>=-37.8&&z<=-48.1;
        const active=grade>.27&&!approachingBridge&&!castleApproach;
        if(!active){previousTop=null;previousActive=false;continue;}
        const half=width/2;
        const crossSection=(site,side)=>[site.x+nx*half*side,site.z+nz*half*side];
        const al=crossSection(a,1),ar=crossSection(a,-1),bl=crossSection(b,1),br=crossSection(b,-1);
        const top=Math.max(...[al,ar,bl,br].map(([px,pz])=>pavedRoadHeight(px,pz,offset)))+.075;
        putQuad(treadPositions,treadUvs,treadIndices,[
          [al[0],top,al[1]],[ar[0],top,ar[1]],
          [bl[0],top,bl[1]],[br[0],top,br[1]],
        ]);
        if(previousActive&&Math.abs(top-previousTop)>.045){
          const lo=Math.min(top,previousTop),hi=Math.max(top,previousTop);
          putQuad(riserPositions,riserUvs,riserIndices,[
            [al[0],lo,al[1]],[ar[0],lo,ar[1]],
            [al[0],hi,al[1]],[ar[0],hi,ar[1]],
          ]);
        }
        stairRuns.push({x,z,top,width,grade});
        previousTop=top;previousActive=true;
      }
    }
    for(const [positions,uvs,indices,material] of [
      [treadPositions,treadUvs,treadIndices,'paving'],
      [riserPositions,riserUvs,riserIndices,'stonePath'],
    ]){
      if(!indices.length)continue;
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
      geo.setIndex(indices);geo.computeVertexNormals();
      const pavement=materials.get(material);
      if(material==='stonePath')pavement.side=T.DoubleSide;
      collectSurface(geo,pavement);
    }
  }
  function infrastructure(waterMats) {
    for(let i=0;i<mainRoads.length;i++) {
      const road=mainRoads[i];
      // A single stone surface is shared at all junctions. The dark underlay
      // used to show through as crossed stripes at every intersection.
      const roadLevel=.052+i*.00042;
      ribbon(road.p,road.w,i>=6?'paving':'road',roadLevel,{
        elevation:(x,z)=>pavedRoadHeight(x,z,roadLevel)});
      if(i<6)roadStairs(road.p,road.w,roadLevel);
    }
    // A long watercourse threads several neighborhoods together. No walls partition the districts.
    for(let i=0;i<minorRoads.length;i++){
      const road=minorRoads[i];
      const roadLevel=.058+i*.00038;
      ribbon(road.p,road.w,'road',roadLevel,{
        elevation:(x,z)=>pavedRoadHeight(x,z,roadLevel)});
      roadStairs(road.p,road.w,roadLevel);
    }
    // The river surface follows its carved channel, not the higher banks. A
    // nearest-centerline level makes water remain level across its width.
    // At its mouth the river gradually sinks into the open sea.
    const mouthBlend=(x,z)=>{
      const t=clamp((z-(coast(x)-7))/16,0,1);
      return t*t*(3-2*t);
    };
    riverSurfaceHeight=(x,z)=>{
      let closest=Infinity,centerX=x,centerZ=z;
      for(let i=1;i<riverPoints.length;i++){
        const [ax,az]=riverPoints[i-1],[bx,bz]=riverPoints[i];
        const dx=bx-ax,dz=bz-az;
        const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
        const px=ax+dx*t,pz=az+dz*t,distance=(x-px)**2+(z-pz)**2;
        if(distance<closest){closest=distance;centerX=px;centerZ=pz;}
      }
      const mouth=mouthBlend(centerX,centerZ);
      return (heightAt(centerX,centerZ)+.14)*(1-mouth)-.34*mouth;
    };
    const clipRiverAtMouth=coastOffset=>{
      const clipped=[riverPoints[0]];
      for(let i=1;i<riverPoints.length;i++){
        const [ax,az]=riverPoints[i-1],[bx,bz]=riverPoints[i];
        const inside=t=>{
          const x=ax+(bx-ax)*t,z=az+(bz-az)*t;
          return z<=coast(x)+coastOffset;
        };
        if(inside(1)){clipped.push(riverPoints[i]);continue;}
        let left=0,right=1;
        for(let j=0;j<17;j++){
          const mid=(left+right)/2;
          if(inside(mid))left=mid;else right=mid;
        }
        clipped.push([ax+(bx-ax)*left,az+(bz-az)*left]);
        break;
      }
      return clipped;
    };
    const clipRiverAtHead=points=>{
      let start=1;
      const inside=([x,z])=>z>=northTerrainEdge(x)+.6;
      while(start<points.length&&!inside(points[start]))start++;
      if(start===points.length)return [];
      const [ax,az]=points[start-1],[bx,bz]=points[start];
      let low=0,high=1;
      for(let i=0;i<17;i++){
        const mid=(low+high)/2;
        if(inside([ax+(bx-ax)*mid,az+(bz-az)*mid]))high=mid;
        else low=mid;
      }
      return [[ax+(bx-ax)*high,az+(bz-az)*high],...points.slice(start)];
    };
    // A continuous, slightly varying channel creates soft bends. The wider
    // sandy bed is visible through the water and fades into the sea. Straight
    // black retaining strips and floating paved bank ribbons have been removed.
    const riverBedPoints=clipRiverAtHead(clipRiverAtMouth(-3.4));
    const riverWaterPoints=clipRiverAtHead(clipRiverAtMouth(1.1));
    ribbon(riverBedPoints,10,'wetSand',.067,{rough:.006,crossSections:6,
      widthAt:(x,z)=>(riverWidth(x,z)+1.7+.46*Math.sin(z*.13-x*.055))*headwaterFade(x,z),
      centerOffsetAt:(x,z)=>.25*Math.sin(z*.14+x*.08),
      elevation:(x,z)=>Math.min(terrainSurfaceAt(x,z)+.08,riverSurfaceHeight(x,z)-.1)});
    ribbon(riverWaterPoints,7.65,waterMats.river,.086,{rough:0,crossSections:8,
      widthAt:riverWidth,elevation:riverSurfaceHeight});
    for(const bridge of bridgeProfiles) {
      const {x,z,length,width,heading,deckY,roadIndex}=bridge;
      const roadWidth=mainRoads[roadIndex].w;
      // Stone slab sits immediately below the uninterrupted paved road ribbon.
      part('stone','box',x,0,z,length,.28,width+.23,heading,0,0,deckY-.15);
      for(const side of [-1,1]){
        const [cx,cz]=local(x,z,0,side*(roadWidth/2+.19),heading);
        part('quay','box',cx,0,cz,length+.16,.30,.22,heading,0,0,deckY+.09);
        for(let dx=-length/2+.8;dx<length/2-.4;dx+=2.45){
          const [px,pz]=local(x,z,dx,side*(roadWidth/2+.19),heading);
          part('pale','box',px,0,pz,.18,.48,.21,heading,0,0,deckY+.38);
        }
      }
      for(const dx of [-length/2+1.4,length/2-1.4]){
        const [px,pz]=local(x,z,dx,0,heading);
        const base=heightAt(px,pz),support=Math.max(.28,deckY-base-.16);
        part('stone','box',px,support/2,pz,.85,support,width+.25,heading,0,0,base);
      }
    }
  }
  function tree(x,z,r=1.2,type='green') {
    part('timber','cylinder',x,r*.9,z,.16*r,1.9*r,.16*r);
    const colors=type==='flower'?['flowers','rose','pale']:['greenery','greenDark','greenery'];
    part(colors[0],'crown',x,r*1.95,z,r*.8,r*1.13,r*.8);
    part(colors[1],'crown',x-r*.32,r*1.48,z+r*.18,r*.52,r*.67,r*.54);
    part(colors[2],'crown',x+r*.28,r*1.76,z-r*.12,r*.48,r*.65,r*.48);
  }
  function scenicFree(x,z,r=.8,allowReserved=false) {
    if(x<-57||x>57||z<-46||z>coast(x)-2)return false;
    if(atPolyline(x,z,riverPoints)<4.2+r*.6)return false;
    if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+r*.75))return false;
    if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+r*.7))return false;
    if(occupiedLots.some(lot=>Math.abs(x-lot.x)<lot.halfX+r&&Math.abs(z-lot.z)<lot.halfZ+r))return false;
    if(!allowReserved&&reserved.some(([rx,rz,d])=>Math.hypot(x-rx,z-rz)<d+r*.3))return false;
    return true;
  }
  function groundPatch(x,z,sx,sz,mat='lawn',height=.012) {
    const stone=['road','cobble','paving','quay','stonePath'].includes(mat);
    const uv=(px,pz)=>stone?[px/2.35,pz/5.2]:[px,pz];
    const positions=[x,terrainSurfaceAt(x,z)+height,z],uvs=uv(x,z),indices=[];
    for(let i=0;i<=32;i++){
      const a=i/32*TAU,rough=1+.065*Math.sin(i*2.8+x*.7+z*.27);
      const px=x+Math.cos(a)*sx*rough,pz=z+Math.sin(a)*sz*rough;
      positions.push(px,terrainSurfaceAt(px,pz)+height,pz);
      uvs.push(...uv(px,pz));
      if(i>0)indices.push(0,i+1,i);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    collectSurface(geometry,materials.get(mat));
  }
  function bench(x,z,yaw=0) {
    part('timber','box',x,.54,z,1.35,.15,.48,yaw);
    part('darkTimber','box',x,.95,z-.21,1.3,.76,.12,yaw);
    for(const dx of [-.5,.5])part('iron','box',x+dx,.28,z,.1,.56,.45,yaw);
  }
  function gardensAndTrees() {
    // Low planted terraces create relief without lifting building foundations.
    for(const [x,z,sx,sz] of [[-45,-50,5,3.4],[-10,-46,4.3,2.3],[42,-44,6,3],[55,-37,3.8,5]]) {
      groundPatch(x,z,sx*1.2,sz*1.16,'meadow',.011);
      part('meadow','dome',x,.035,z,sx,.32,sz);
    }
    // Formal palace gardens and wealthy courtyards, with planting beds and walks.
    const beds=[[-11,-25,3.2,3.3],[19,-25,3.3,3.3],[-10,-18,3.0,2.6],
      [19,-18,3,2.6],[43,-36,4.4,2.6],[47,-15,3.4,3.1],[27,-38,2.8,3.0],
      [44,2,3.0,2.8],[-44,3,2.6,2.8],[11,10,2.6,2.7]];
    for(const [x,z,sx,sz] of beds) {
      if(!scenicFree(x,z,.65))continue;
      groundPatch(x,z,sx+.5,sz+.45,'soil',.012);
      groundPatch(x,z,sx,sz,'lawn',.018);
      if(z< -13) {
        for(const dx of [-sx*.52,sx*.52])for(const dz of [-sz*.57,sz*.57]) {
          part('hedge','box',x+dx,.32,z+dz,sx*.52,.6,.42);
          part('flowers','dome',x+dx*.7,.44,z+dz*.7,.32,.25,.32);
        }
      } else {
        part('flowers','dome',x-.65,.27,z,.6,.34,.55);
        part('flowers','dome',x+.7,.27,z+.3,.5,.3,.56);
      }
    }
    const groves=[[-45,-50,5],[-39,6,4],[-48,11,5],[-12,-25,7],
      [13,-27,6],[24,-37,6],[44,-38,7],[52,-15,5],[48,5,6],
      [13,11,4],[-43,-5,5],[-8,9,4]];
    for(let i=0;i<720;i++) {
      const [cx,cz,r]=groves[Math.floor(random()*groves.length)];
      const a=random()*TAU,dist=Math.sqrt(random())*r;
      const x=cx+Math.cos(a)*dist,z=cz+Math.sin(a)*dist;
      const size=.65+random()*.39;
      if(scenicFree(x,z,size*.54))tree(x,z,size,random()>.85?'flower':'green');
    }
    // Evenly spaced trees guide the eye towards the palace gate.
    for(const z of [-27,-23,-19])for(const x of [-14,23]) {
      if(scenicFree(x,z,.45,true))tree(x,z,.84,'green');
    }
    for(const [x,z,a] of [[-7,12,0],[11,-8,1],[43,-9,0],[23,-34,1],[-46,2,1]]) {
      if(scenicFree(x,z,.75,true))bench(x,z,a);
    }
  }
  function openHillside(x,z,r=.8){
    if(x< -57||x>57||z< -91||z> -31)return false;
    if(Math.abs(x-5)<17&&z< -47&&z> -68)return false;
    if(atPolyline(x,z,riverPoints)<riverWidth(x,z)/2+2+r)return false;
    if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+r+.95))return false;
    if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+r+.7))return false;
    if(housePaths.some(path=>atPolyline(x,z,path)<r+.42))return false;
    if(occupiedLots.some(lot=>Math.abs(x-lot.x)<lot.halfX+r+.6&&
      Math.abs(z-lot.z)<lot.halfZ+r+.6))return false;
    return !reserved.some(([xx,zz,clearance])=>Math.hypot(x-xx,z-zz)<clearance+r);
  }
  function hillsideLandscaping(){
    // Clusters of scrub, sparse groves and exposed stone break up the bare
    // palace hill without overwhelming the main facade or blocking footpaths.
    const clusters=[[-45,-72,9],[-39,-55,7],[-18,-72,8],[-9,-40,7],
      [35,-70,8],[44,-57,10],[48,-78,10],[36,-43,6]];
    let planted=0,rocky=0;
    for(let i=0;i<620&&(planted<26||rocky<26);i++){
      const [cx,cz,extent]=clusters[Math.floor(random()*clusters.length)];
      const a=random()*TAU,radius=Math.sqrt(random())*extent;
      const x=cx+Math.cos(a)*radius,z=cz+Math.sin(a)*radius;
      const size=.46+random()*.49;
      if(!openHillside(x,z,size*.76))continue;
      if(i%3===0&&rocky<26){
        part('stone','crown',x,size*.16,z,size*.95,size*.44,size*.72);
        if(random()>.54)groundPatch(x,z,size*1.55,size*1.08,'meadow',.023);
        rocky++;
      }else if(planted<26){
        tree(x,z,size,random()>.92?'flower':'green');
        if(i%6===0)groundPatch(x,z,1.25+size,1.1+size*.4,'meadow',.021);
        planted++;
      }
    }
  }
  function riverbankLandscaping(){
    // Irregular small stones and reeds emphasize the changing bank profile.
    // Keep the bridge landings and building footprints completely clear.
    for(let i=6;i<riverPoints.length-7;i+=3){
      const [x,z]=riverPoints[i];
      const prev=riverPoints[i-2],next=riverPoints[i+2];
      const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz)||1;
      const nx=-dz/len,nz=dx/len;
      const side=i%2?1:-1;
      const bankDistance=riverWidth(x,z)*.5+1.12+random()*.8;
      const px=x+nx*side*bankDistance,pz=z+nz*side*bankDistance;
      const radius=.3+random()*.38;
      if(!openHillside(px,pz,radius)&&!scenicFree(px,pz,radius,true))continue;
      if(bridgeProfiles.some(bridge=>Math.hypot(px-bridge.x,pz-bridge.z)<9.0))continue;
      if(random()>.32)part('stone','crown',px,radius*.21,pz,radius*.92,radius*.44,radius*.76);
      if(random()>.28){
        for(let j=0;j<3;j++){
          const xx=px+(j-1)*.27,zz=pz+(j%2)*.24;
          part(j%3===0?'grain':'greenDark','cone',xx,.36,zz,.10,.72+random()*.38,.10);
        }
      }
    }
  }
  function greenOutskirts() {
    // Side groves and sparse northern copses follow the roads into the distant hills.
    for(let i=0;i<310;i++) {
      const northern=i>=138,side=i%2?-1:1;
      const x=northern?-109+random()*218:side*(65+random()*44);
      const z=northern?-89+random()*40:-46+random()*64;
      if(z>coast(x)-4.5)continue;
      if(atPolyline(x,z,riverPoints)<6.2)continue;
      if(reserved.some(([rx,rz,r])=>Math.hypot(x-rx,z-rz)<r+2.4))continue;
      if(atPolyline(x,z,farmAccess)<2.1)continue;
      if(occupiedLots.some(lot=>Math.abs(x-lot.x)<lot.halfX+1.25&&Math.abs(z-lot.z)<lot.halfZ+1.25))continue;
      if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+1.9))continue;
      if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+1.5))continue;
      if(i%8===0)groundPatch(x,z,1.9+random()*2.5,1.1+random()*2,'meadow',.027);
      if(random()>(northern?.48:.34))tree(x,z,.65+random()*.69,random()>.94?'flower':'green');
    }
  }
  function factoryComplex() {
    const smokeMaterial=new T.MeshBasicMaterial({color:'#adb0a2',transparent:true,opacity:.17,depthWrite:false});
    effectMaterials.push(smokeMaterial);
    for(const [x,z,w,d,h] of factorySites) {
      const factoryGround=heightAt(x,z);
      // Foundations extend into the sloping west-bank terrain at every corner.
      const depth=foundationDepth(x,z,w/2,d/2);
      part('stone','box',x,.08-depth/2,z,w+.34,depth+.16,d+.34);
      part('brick','box',x,h/2,z,w,h,d);
      // Three complete adjoining roof bays, joined at even ridges and eaves.
      for(let i=0;i<3;i++) {
        const bay=w/3,xx=x-w/2+(i+.5)*bay,rise=.78;
        const angle=Math.atan2(rise,bay/2),panel=Math.hypot(bay/2,rise)+.2;
        part('roofDark','box',xx-bay/4,h+rise/2,z,panel,.19,d+.35,0,angle,0,factoryGround);
        part('roofDark','box',xx+bay/4,h+rise/2,z,panel,.19,d+.35,0,-angle,0,factoryGround);
        part('iron','box',xx,h+rise+.045,z,.105,.11,d+.4,0,0,0,factoryGround);
      }
      for(let i=-2;i<=2;i++)part('windows','box',x+i*w*.13,h*.52,z+d/2+.07,.55,1.1,.1,0,0,0,factoryGround);
      part('darkTimber','box',x-w*.3,1.65,z+d/2+.11,1.9,2.75,.12);
      part('roofDark','box',x-w*.3,3.12,z+d/2+.59,2.45,.16,1.13,0,0,0,factoryGround);
      for(const xx of [x-w*.3-.98,x-w*.3+.98])
        part('timber','box',xx,1.37,z+d/2+1.03,.13,2.73,.13,0,0,0,factoryGround);
      for(let i=-1;i<=1;i++)part('iron','box',x+i*w*.22,h*.73,z-d/2-.06,.18,1.3,.19,0,0,0,factoryGround);
    }
    for(const [x,z,r,h] of [[-98,-41,.62,11],[-93,-41,.53,14],[-105,-22,.48,9]]) {
      part('darkBrick','cylinder',x,h/2,z,r,h,r);
      part('stone','cylinder',x,h-.12,z,r*1.16,.3,r*1.16);
      part('iron','cylinder',x,h+.13,z,r*.9,.35,r*.9);
      for(let i=0;i<5;i++) {
        smokePuffs.push({x,z,height:heightAt(x,z)+h+.4,phase:i/5+random()*.1,drift:random()*TAU});
      }
    }
    smokeBatch=new T.InstancedMesh(geometries.dome,smokeMaterial,smokePuffs.length);
    smokeBatch.name='factory-smoke';smokeBatch.frustumCulled=false;
    smokeBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(smokeBatch);
    // Cargo and an uninterrupted yard stay on the same west bank as the works;
    // the former railway viaduct ended in a hillside and has been removed.
    groundPatch(-95,-48,8.3,1.65,'road',.048);
    groundPatch(-88.7,-33,3.8,2.1,'road',.048);
    for(const [x,z] of [[-101,-47],[-98,-47]]) {
      part('iron','cylinder',x,1.5,z,1.25,2.8,1.25);
      part('quay','cylinder',x,3.03,z,1.32,.15,1.32);
    }
    for(const [x,z] of [[-93,-47],[-90,-35],[-87,-37]]) {
      part('timber','box',x,.68,z,1.1,1.15,1.1);
      part('iron','box',x,1.29,z,1.17,.08,1.16);
    }
    // Working yards: timber stacks, utility tanks and handcarts rather than
    // further identical factory roofs and dozens of narrow chimneys.
    for(const [x,z] of [[-100,-49],[-89,-34],[-102,-31]]){
      for(let i=0;i<4;i++)part('timber','box',x+(i%2)*.8,.31+(i>>1)*.28,z,.73,.29,2.15);
      part('iron','cylinder',x+1.8,1.02,z-.6,.62,2.05,.62);
      part('quay','cylinder',x+1.8,2.08,z-.6,.7,.14,.7);
    }
    // Short stone access walks end at a factory gate or an existing main road.
    for(const [from,to] of [
      [[-95,-36.95],[-95,-28.7]],
      [[-104,-18.95],[-104,-12.1]],
      [[-91,-18.95],[-91,-12.1]],
      [[-89.4,-40],[-86,-40]],
    ])ribbon([from,to],1.15,'road',.046,{elevation:(x,z)=>pavedRoadHeight(x,z,.046)});
  }
  function agriculturalFields() {
    // Fields occupy the distant northeastern countryside. Soil beds, furrows,
    // crops and low field borders all sample the actual rolling terrain.
    for(const [x,z,w,d,plant] of fieldPlots){
      ribbon([[x-w/2,z],[x+w/2,z]],d,'soil',.035,{rough:.015});
      const border=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],
        [x-w/2,z+d/2],[x-w/2,z-d/2]];
      ribbon(border,.22,'paths',.065);
      let row=0;
      for(let zz=z-d/2+1.15;zz<z+d/2-.65;zz+=1.13){
        const inset=.68+(row%3)*.13;
        ribbon([[x-w/2+inset,zz],[x+w/2-inset,zz]],.46,plant,.095,{rough:.08});
        for(let xx=x-w/2+1.15;xx<x+w/2-.7;xx+=3.2){
          if((row+Math.round(xx*3))%3===0)continue;
          part(plant,'crown',xx,.3,zz,.25,.32,.29);
        }
        row++;
      }
      for(const xx of [x-w/2,x+w/2])for(const zz of [z-d/2,z+d/2]){
        part('timber','box',xx,.31,zz,.11,.62,.11);
      }
      // Every field has a short paved entrance from the shared rural lane.
      const laneZ=z> -54?-54:-74;
      const fieldGate=z>laneZ?z-d/2:z+d/2;
      ribbon([[x,laneZ],[x,fieldGate]],.72,'road',.046);
    }
    ribbon(farmAccess,1.05,'road',.05);
    ribbon([[52,-74],[52,-54]],1.05,'road',.05);
    ribbon(upperFarmAccess,1.05,'road',.05);
  }
  function countrysideWindmill() {
    const x=93,z=-33,base=heightAt(x,z);
    // Stone-and-plaster tower on the upper farmland's skyline.
    part('stone','cylinder',x,3.55,z,2.12,7.1,2.12);
    part('plaster','cylinder',x,7.4,z,1.64,.85,1.64);
    part('roofDark','cone',x,8.32,z,2.65,1.75,2.65);
    part('darkTimber','box',x,1.3,z-2.15,.92,2.24,.15);
    part('iron','dome',x+.26,1.3,z-2.24,.085,.085,.085);
    part('darkTimber','box',x,4.8,z+2.15,.57,.86,.14);
    part('litWindow','box',x,4.8,z+2.23,.39,.66,.09);
    ribbon([[x,-54],[x,-35.5]],1.05,'road',.053,
      {elevation:(px,pz)=>pavedRoadHeight(px,pz,.053)});
    windmillRotor=new T.Group();windmillRotor.name='windmill-rotor';
    windmillRotor.position.set(x,base+6.1,z+2.45);
    const blades=[];
    const bladeMesh=(mat,w,h,depth,yy,zz=0)=>{
      const geo=new T.BoxGeometry(w,h,depth);
      const mesh=new T.Mesh(geo,materials.get(mat));mesh.position.set(0,yy,zz);
      blades.push(geo);return mesh;
    };
    for(let i=0;i<4;i++){
      const blade=new T.Group();blade.rotation.z=i*Math.PI/2;
      blade.add(bladeMesh('darkTimber',.2,4.3,.23,2.25));
      blade.add(bladeMesh('pale',1.08,2.6,.12,3.12,.11));
      for(let j=0;j<6;j++)blade.add(bladeMesh('timber',1.22,.085,.15,1.95+j*.46,.21));
      windmillRotor.add(blade);
    }
    windmillRotor.userData.bladeGeometries=blades;
    const hubGeo=new T.CylinderGeometry(.49,.49,.48,12);hubGeo.rotateX(Math.PI/2);
    const hub=new T.Mesh(hubGeo,materials.get('iron'));
    hub.position.z=.21;windmillRotor.add(hub);
    blades.push(hubGeo);
    scene.add(windmillRotor);
  }
  function palaceComplex() {
    // One whole compound shifts twenty metres uphill towards the northern
    // countryside; every foundation, tower, tree and flag shares the offset.
    const offsetZ=-20;
    const castle=(material,shape,x,y,z,...rest)=>part(material,shape,x,y,z+offsetZ,...rest);
    const castleTree=(x,z,r)=>tree(x,z+offsetZ,r);
    castle('palaceBase','box',5,1.08,-37,28,2.1,16);
    castle('stone','box',5,2.22,-37,27.7,.3,15.8);
    castle('stone','box',5,2.46,-35,9,.13,17);
    // A properly tessellated paved courtyard has the same-sized stone setts
    // as the streets below, including where the north road meets the gate.
    pavedRectangle(5,-55,9,17,2.54);
    const wings=[[-4,-39,8,8,5.4],[14,-39,8,8,5.4],[5,-41,9,8,7.2]];
    for(const [x,z,w,d,h] of wings) {
      const wingGround=heightAt(x,z+offsetZ);
      castle('palaceWall','box',x,2.4+h/2,z,w,h,d);
      const rise=w*.32,ang=Math.atan2(rise,w/2),length=Math.hypot(w/2,rise)+.7;
      castle('roofPalace','box',x-w/4,2.4+h+rise/2,z,length,.26,d+.7,0,ang,0,wingGround);
      castle('roofPalace','box',x+w/4,2.4+h+rise/2,z,length,.26,d+.7,0,-ang,0,wingGround);
      // Larger, evenly spaced panes on both faces and multiple storeys make
      // the palace read as an occupied residence instead of blank stone walls.
      const storeys=h>6?[4.18,6.32,8.38]:[4.18,6.34];
      for(const side of [-1,1])for(const windowY of storeys)for(let j=-1;j<=1;j++) {
        const windowX=x+j*w*.255,windowZ=z+side*(d/2+.085);
        const lit=random()>.4;
        castle('darkTimber','box',windowX,windowY,windowZ,1.22,1.82,.19,0,0,0,wingGround);
        castle(lit?'litWindow':'windows','box',windowX,windowY,windowZ+side*.112,.98,1.57,.09,0,0,0,wingGround);
        castle('pale','box',windowX,windowY-.96,windowZ+side*.13,1.35,.12,.25,0,0,0,wingGround);
        palaceWindowPanes.push({x:windowX,y:wingGround+windowY,z:windowZ+offsetZ,width:.98,height:1.57});
        if(lit)windowLightSites.push({x:windowX,y:wingGround+windowY,z:windowZ+offsetZ+side*.19});
      }
      // The lateral elevations were almost blank when viewed isometrically.
      for(const side of [-1,1])for(const windowY of [4.1,6.25])for(const dz of [-d*.24,d*.24]) {
        const xx=x+side*(w/2+.09),zz=z+dz,lit=random()>.52;
        castle('darkTimber','box',xx,windowY,zz,.18,1.78,1.18,0,0,0,wingGround);
        castle(lit?'litWindow':'windows','box',xx+side*.106,windowY,zz,.08,1.51,.94,0,0,0,wingGround);
        castle('pale','box',xx+side*.14,windowY-.93,zz,.26,.11,1.3,0,0,0,wingGround);
        palaceWindowPanes.push({x:xx,y:wingGround+windowY,z:zz+offsetZ,width:.94,height:1.51});
      }
    }
    for(const [x,z] of [[-10,-44],[20,-44],[-10,-30],[20,-30]]) {
      castle('palaceBase','cylinder',x,.36,z,2.8,.72,2.8);
      castle('stone','tower',x,4.1,z,2.5,8.2,2.5);
      castle('roofJade','cone',x,9.6,z,3.15,2.8,3.15);
      castle('iron','cylinder',x,11.65,z,.1,1.8,.1);
    }
    // Monumental entry gate and garden terraces.
    for(const x of [-.3,10.3]){
      castle('palaceBase','box',x,.25,-28.6,2.35,.5,2.7);
      castle('stone','box',x,2.95,-28.6,1.95,5.9,2.4);
      castle('darkTimber','box',x,3.92,-27.28,.72,1.56,.13);
      castle('litWindow','box',x,3.92,-27.18,.5,1.32,.08);
    }
    castle('roofPalace','box',5,6.17,-28.6,13,.5,3.05);
    // A true open stone arch makes the gateway readable even from far away.
    // Its stones share a common ground plane, unlike independent hill samples.
    const gateZ=-48.35,archGround=heightAt(5,gateZ);
    for(let i=0;i<17;i++) {
      const angle=(i+.5)/17*Math.PI;
      const xx=5+3.96*Math.cos(angle),yy=2.16+3.83*Math.sin(angle);
      part(i===8?'pale':'stone','box',xx,yy,gateZ+.18,.79,.59,.65,
        0,angle+Math.PI/2,0,archGround);
    }
    // Rise to the open gate with short, solid stone treads. Each level starts
    // at the actual hill surface; no giant projecting block obscures the arch.
    const entryStart=-38.1,entryEnd=-47.48,entrySteps=38;
    let lastTop=-Infinity;
    for(let i=0;i<entrySteps;i++) {
      const t=(i+.5)/entrySteps,z=entryStart+(entryEnd-entryStart)*t;
      const run=(entryStart-entryEnd)/entrySteps;
      const corners=[[-3.25,-run/2],[3.25,-run/2],[-3.25,run/2],[3.25,run/2]]
        .map(([dx,dz])=>heightAt(5+dx,z+dz));
      const bottom=Math.min(...corners)-.22;
      const lift=2.42*smoothstep(0,1,(i+1)/entrySteps);
      const top=Math.max(Math.max(...corners)+.10+lift,lastTop+.058);
      part('stone','box',5,(top+bottom)/2,z,6.5,top-bottom,run+.028,0,0,0,0);
      // Light stone nosing marks the real leading edge of every step.
      part('pale','box',5,top+.024,z+run/2-.065,6.56,.047,.13,0,0,0,0);
      palaceEntrySteps.push({x:5,z,top,run,width:6.5});
      lastTop=top;
    }
    // Wider pause ledges interrupt the long slope and support the stone balustrade.
    for(const stepIndex of [12,25]) {
      const step=palaceEntrySteps[stepIndex],lowest=heightAt(5,step.z)-.2;
      part('stone','box',5,(step.top+lowest)/2,step.z,7.25,step.top-lowest,.66,0,0,0,0);
      part('pale','box',5,step.top+.025,step.z,7.38,.065,.7,0,0,0,0);
    }
    // A narrow threshold unites the staircase with the existing courtyard.
    const gateGround=heightAt(5,-48.6);
    const thresholdTop=gateGround+2.46;
    part('stone','box',5,thresholdTop-.18,-48.5,8.5,.36,2.25,0,0,0,0);
    for(const x of [-15,25])for(const z of [-38,-32])castleTree(x,z,1.1);
    // The northern road enters through the far side of the palace.
    ribbon([[5,-65],[5,-63],[5,-58]],2.7,'road',2.4);
    for(const x of [-10,20]) {
      castle('stone','cylinder',x,.38,-21,1.15,.68,1.15);
      castle('river','cylinder',x,.76,-21,.78,.13,.78);
      castle('pale','dome',x,.99,-21,.22,.35,.22);
    }
    for(const x of [-9,19])for(const z of [-27,-24,-18]) {
      castle('hedge','box',x,.39,z,2.65,.72,.48);
      castle('flowers','dome',x,.64,z,.52,.27,.44);
    }
    // Two flags make the keep recognizable above the surrounding roofs.
    for(const x of [-10,20]) {
      castle('iron','cylinder',x,12.45,-44,.075,3.0,.075);
      castle('roofRed','box',x+.57,13.15,-44,1.1,.7,.085);
    }
  }
  function museumAndTheater() {
    // Art district museum: a portico, colonnade and small copper dome.
    const x=32,z=0;
    pavedRectangle(x,z+7.0,14,4.6,.055,'paving');
    part('pale','box',x,2.8,z,12,5.6,8);
    part('roofCopper','box',x,5.93,z,12.7,.36,8.6);
    for(let i=-2;i<=2;i++)part('stone','cylinder',x+i*2.1,2.65,z+4.2,.31,5.3,.31);
    part('stone','box',x,5.36,z+4.3,12,.55,1.8);
    part('roofJade','dome',x,6.6,z,3.7,1.55,3.5);
    part('iron','cylinder',x,8.55,z,.15,1.2,.15);
    for(let dx=-2;dx<=2;dx++)part('stone','box',x, .11+dx*.13,z+6+dx*.47,12,.24,.55);
    // Two copper banners frame the main entrance, so the museum reads clearly
    // among the neighboring pale-stone gallery houses.
    for(const sx of [26.9,37.1]) {
      part('roofCopper','box',sx,3.48,z+4.8,.36,3.55,.15);
      part('pale','box',sx,5.48,z+4.86,.56,.17,.24);
    }
    for(const sx of [23,41]) {
      // Tall sculptural silhouettes on plinths mark the Arts quarter.
      part('stone','cylinder',sx,.65,0,1.13,1.3,1.13);
      part('pale','box',sx,1.49,0,1.55,.36,1.55);
      part('roofCopper','cone',sx,2.72,0,.57,2.13,.57);
      part('pale','dome',sx,4.0,0,.38,.44,.35);
      part('roofCopper','box',sx+.51,3.18,0,.92,.13,.2,0,.35);
      part('stone','box',sx,1.9,.43,.55,.14,.52);
    }
    // Bohemian theater and square.
    const tx=0,tz=-5;
    part('ochre','box',tx,2.4,tz,7.5,4.8,6.7);
    part('roofRed','box',tx,5.1,tz,8.3,.42,7.4);
    for(let i=-2;i<=2;i++)part('pale','box',tx+i*1.23,2.8,tz+3.5,.42,3.2,.55);
    part('roofTile','box',tx,5.8,tz+3.4,8.4,1.3,.25);
    pavedRectangle(tx,tz+7.3,8,5,.049);
    // The bannered theater is the neighborhood silhouette from map zoom.
    for(const side of [-1,1]){
      const xx=tx+side*3.42;
      part('darkTimber','cylinder',xx,5.72,tz+3.72,.09,2.6,.09);
      part(side<0?'roofRed':'roofJade','box',xx+side*.56,6.43,tz+3.75,1.04,.7,.09);
      part('pale','box',xx+side*.51,5.94,tz+3.75,.82,.12,.11);
    }
    part('roofCopper','dome',tx,6.49,tz+3.64,2.15,.52,.33);
    part('stone','box',tx,1.03,tz+4.13,3.6,.18,1.1);
    tree(-4,-1,.85,'flower');tree(4,-1,.8,'flower');
    for(const xx of [-5,5]){
      part('timber','box',xx,.8,2.6,1.35,1.5,.86);
      part('roofRed','box',xx,1.66,2.6,1.6,.18,1.1);
      part('flowers','dome',xx,1.94,2.6,.58,.3,.46);
    }
  }
  function oldTownCivicSquare() {
    // A clock tower above a compact craft market gives the old residential
    // streets a characteristic focal point even from the full-map view.
    pavedRectangle(-42,-.45,10.6,7.2,.072,'paving');
    const x=-46,z=.15,base=heightAt(x,z);
    part('stone','box',x,.29,z,3.25,.58,3.25,0,0,0,base);
    part('ochre','box',x,4.13,z,2.7,7.95,2.7,0,0,0,base);
    for(const dx of [-1.34,1.34])for(const dz of [-1.34,1.34])
      part('darkTimber','box',x+dx,4.16,z+dz,.15,7.97,.15,0,0,0,base);
    part('stone','box',x,8.22,z,3.03,.43,3.04,0,0,0,base);
    for(const face of [-1,1]) {
      const front=z+face*1.43;
      part('darkTimber','cylinder',x,6.85,front,.88,.2,.88,0,0,Math.PI/2,base);
      part('pale','cylinder',x,6.85,front+face*.14,.74,.15,.74,0,0,Math.PI/2,base);
      part('darkTimber','box',x,7.08,front+face*.25,.12,.44,.12,0,0,0,base);
      part('darkTimber','box',x+.18,6.85,front+face*.25,.45,.1,.12,0,0,0,base);
    }
    part('roofRed','cone',x,9.48,z,2.52,2.3,2.52,0,0,0,base);
    part('iron','cylinder',x,11.08,z,.12,.95,.12,0,0,0,base);
    for(const [mx,mz,roof] of [[-39.3,-1.55,'roofOchre'],[-39.3,1.35,'roofRed']]) {
      const marketGround=heightAt(mx,mz);
      part('timber','box',mx,.46,mz,2.35,.78,1.76,0,0,0,marketGround);
      part(roof,'box',mx,2.12,mz,2.68,.21,2.1,0,0,0,marketGround);
      for(const dx of [-1.05,1.05])for(const dz of [-.74,.74])
        part('darkTimber','box',mx+dx,1.29,mz+dz,.12,1.74,.12,0,0,0,marketGround);
      part('flowers','dome',mx,.98,mz,.51,.24,.38,0,0,0,marketGround);
    }
    part('stone','cylinder',-43,.26,2.85,.86,.52,.86);
    part('river','cylinder',-43,.56,2.85,.59,.13,.59);
    bench(-45,3.05,.2);
  }
  function upperCityGarden() {
    // Symmetrical clipped planting, long axes and a small fountain make the
    // affluent hill neighborhood identifiable independently of roof colors.
    const x=43,z=-40;
    groundPatch(x,z,4.9,4.7,'lawn',.031);
    ribbon([[x-3.9,z],[x+3.9,z]],1.2,'stonePath',.054);
    ribbon([[x,z-3.7],[x,z+3.7]],1.0,'stonePath',.056);
    for(const side of [-1,1]){
      for(const dz of [-2.9,2.9]) {
        part('hedge','box',x+side*2.35,.44,z+dz,3.0,.85,.42);
        part('flowers','dome',x+side*2.35,.88,z+dz,.6,.28,.43);
      }
      part('hedge','box',x+side*3.95,.43,z,.46,.83,4.2);
      for(const dz of [-3.6,3.6]){
        part('timber','cylinder',x+side*4.3,1.05,z+dz,.17,2.05,.17);
        part('greenDark','cone',x+side*4.3,2.5,z+dz,.74,3.05,.74);
      }
    }
    const fy=heightAt(x,z);
    part('stone','cylinder',x,.38,z,1.52,.76,1.52,0,0,0,fy);
    part('river','cylinder',x,.79,z,1.27,.13,1.27,0,0,0,fy);
    part('stone','cylinder',x,1.21,z,.28,.79,.28,0,0,0,fy);
    part('river','dome',x,1.69,z,.42,.24,.42,0,0,0,fy);
    part('pale','dome',x,1.94,z,.12,.27,.12,0,0,0,fy);
  }
  function oldTownMarket() {
    // Market arch and covered stalls near the team hideout.
    pavedRectangle(-13,15,9,5.7,.049);
    for(const x of [-16.3,-12.4,-8.5]) {
      part('timber','box',x,.8,15,2.3,1.5,2.4);
      part('roofRed','box',x,1.65,15,2.8,.25,2.8);
      for(const xx of [-1.05,1.05])part('darkTimber','box',x+xx,.8,16.3,.13,1.6,.15);
    }
    part('pale','box',-14,1.8,9,2.3,3.4,2.3);
    part('roofTile','cone',-14,4.1,9,1.7,2.1,1.7);
    for(const [x,z] of [[-18,17],[-11,17],[-8,12]]) {
      part('timber','cylinder',x,.42,z,.3,.84,.3);
      part('quay','cylinder',x,.88,z,.34,.1,.34);
      part('timber','box',x+1,.38,z,.73,.7,.67);
    }
    for(const x of [-16.3,-12.4,-8.5]){
      part('roofOchre','box',x,2.11,15.25,2.55,.11,2.9);
      part('iron','box',x,1.05,16.32,.36,.2,.12);
    }
  }
  function portAndQuays() {
    for(const {x,length,width,kind} of pierLayouts) {
      const z=coast(x);
      part('quay','box',x,-.23,z+length/2,width,.48,length);
      part('timber','box',x,.08,z+length/2,width+.08,.17,length+.1);
      for(const dx of [-width*.47,width*.47])for(let zz=z+1;zz<z+length;zz+=2.7) {
        part('darkTimber','cylinder',x+dx,-.5,zz,.15,1.4,.15);
      }
      for(let zz=z+1;zz<z+length;zz+=.85)part('plaster','box',x,.17,zz,width+.1,.045,.075);
      if(kind==='cargo'){
        // Wider pier heads provide usable loading berths on either side.
        part('quay','box',x,-.23,z+length-1.1,width+2.0,.48,2.25);
        part('timber','box',x,.08,z+length-1.1,width+2.03,.17,2.3);
        for(const side of [-1,1]){
          part('darkTimber','cylinder',x+side*(width/2+1.0),-.22,z+length-1.1,.16,1.16,.16);
          part('iron','cylinder',x+side*(width/2+.6),.48,z+length-.3,.19,.55,.19);
        }
      }else{
        // A simple fishing shade gives the smaller landing its own silhouette.
        const shadeZ=z+3.35;
        for(const side of [-1,1])part('timber','box',x+side*(width*.43),1.17,shadeZ,.12,2.3,.12);
        part('roofSlate','box',x,2.39,shadeZ,width+.5,.16,2.5);
        part('timber','box',x,.48,z+length-1.0,width*.67,.4,.78);
      }
    }
    // Cargo warehouse with repeating roof rhythm, no giant lighthouse.
    // The isolated red warehouse beside the eastern pier has been removed.
    for(const [x,z,w,d] of [[-34,16,11,6],[18,15,10,7]]) {
      const warehouseGround=heightAt(x,z);
      const depth=foundationDepth(x,z,w/2,d/2);
      // Waterfront warehouses straddle the descending shore: their long
      // plinths now meet the lower quay rather than floating above sand.
      part('stone','box',x,.08-depth/2,z,w+.26,depth+.16,d+.26,0,0,0,warehouseGround);
      waterfrontWarehouses.push({x,z,w,d,bottom:warehouseGround-depth});
      part('brick','box',x,2.15,z,w,4.3,d);
      const rise=w*.16,ang=Math.atan2(rise,w/2),panel=Math.hypot(w/2,rise)+.2;
      part('roofDark','box',x-w/4,4.3+rise/2,z,panel,.22,d+.3,0,ang,0,warehouseGround);
      part('roofDark','box',x+w/4,4.3+rise/2,z,panel,.22,d+.3,0,-ang,0,warehouseGround);
      for(let i=-2;i<=2;i++)part('windows','box',x+i*w*.16,2.35,z+d/2+.07,.53,1.2,.1,0,0,0,warehouseGround);
    }
    for(const [x,z] of [[-48,17],[-35,21],[-11,17],[8,20],[34,21],[50,16]])for(let i=0;i<4;i++){
      const dx=i%2,dz=Math.floor(i/2);
      part('timber','box',x+dx*.8,.34,z+dz*.75,.73,.66,.68);
      part('darkTimber','box',x+dx*.8,.68,z+dz*.75,.75,.08,.7);
    }
    // Fish barrels, stacked cargo, mooring bollards and handcarts make docks active.
    for(const [x,z] of [[-40,19],[-32,21],[-11,19],[9,18],[27,18],[44,17],[51,19]]) {
      for(let i=0;i<3;i++){
        part('timber','cylinder',x+i*.65,.51,z+(i%2)*.64,.37,1.02,.37);
        part('iron','cylinder',x+i*.65,.92,z+(i%2)*.64,.38,.085,.38);
      }
    }
    for(const x of [-39,-12,29,48]) {
      const z=coast(x)+1.6;
      for(const dx of [-1.3,1.3]) {
        part('iron','cylinder',x+dx,.32,z,.2,.65,.2);
        part('quay','cylinder',x+dx,.64,z,.28,.14,.28);
      }
    }
    for(const [x,z] of [[-34,21],[23,20],[46,20]]) {
      part('timber','box',x,.66,z,2.0,.9,1.15);
      for(const dx of [-.72,.72]){
        part('darkTimber','cylinder',x+dx,.35,z-.58,.3,.15,.3,0,0,Math.PI/2);
        part('darkTimber','cylinder',x+dx,.35,z+.58,.3,.15,.3,0,0,Math.PI/2);
      }
      part('timber','box',x-1.38,.91,z,1.0,.12,.14);
    }
    // Working cranes: wooden A-frame, an angled jib and a real hanging hook.
    for(const [x,z] of [[-39,coast(-39)+1],[29,coast(29)+2]]) {
      part('timber','box',x,3.15,z,.35,6.3,.4);
      part('timber','box',x+1.55,6.15,z,3.5,.3,.35,0,.12);
      part('iron','box',x+3.05,4.7,z,.06,2.8,.07);
      part('iron','box',x+3.05,3.18,z,.32,.3,.3);
      part('darkTimber','box',x-1,3.4,z,2.8,.22,.22,0,-1.0);
    }
  }
  function boat(x,z,length=5,large=false,angle=0) {
    // Every part belongs to one movable vessel, including mast, sail and cabin.
    const group=new T.Group();group.name=large?'merchant-ship':'fishing-boat';
    const hull=new T.Shape();hull.moveTo(-length*.47,0);hull.quadraticCurveTo(-length*.35,-1.02,-.1,-.9);hull.quadraticCurveTo(length*.4,-.72,length*.52,0);hull.quadraticCurveTo(length*.38,.72,-.1,.9);hull.quadraticCurveTo(-length*.34,.95,-length*.47,0);
    const g=new T.ExtrudeGeometry(hull,{depth:large?.6:.37,bevelEnabled:true,bevelThickness:.12,bevelSize:.13,bevelSegments:1,steps:1,curveSegments:4});
    g.rotateX(-Math.PI/2);
    group.add(new T.Mesh(g,materials.get(large?'darkTimber':'timber')));
    const addPart=(mat,geometry,px,py,pz)=>{
      const mesh=new T.Mesh(geometry,materials.get(mat));mesh.position.set(px,py,pz);group.add(mesh);
    };
    const mastHeight=large?5.15:3.9;
    addPart('pale',new T.BoxGeometry(length*.53,.11,large?1.4:1.0),0,.42,0);
    addPart('darkTimber',new T.CylinderGeometry(.075,.075,mastHeight,8),0,mastHeight/2+.43,0);
    const sailGeo=new T.BufferGeometry();
    sailGeo.setAttribute('position',new T.Float32BufferAttribute([.05,.62,0, .05,mastHeight+.17,0, length*.33,1.12,0],3));
    sailGeo.computeVertexNormals();
    const sailMaterial=new T.MeshStandardMaterial({color:0xdfd3b8,side:T.DoubleSide,roughness:1});
    boatSails.push(sailMaterial);
    group.add(new T.Mesh(sailGeo,sailMaterial));
    if(large) {
      addPart('darkTimber',new T.BoxGeometry(1.4,1.1,1.35),-length*.18,1.05,0);
      addPart('iron',new T.CylinderGeometry(.28,.28,1.2,8),-length*.2,2,0);
      const secondSailGeo=new T.BufferGeometry();
      secondSailGeo.setAttribute('position',new T.Float32BufferAttribute([-.26,.83,.18,-.26,3.95,.18,-length*.28,1.28,.18],3));
      secondSailGeo.computeVertexNormals();
      group.add(new T.Mesh(secondSailGeo,sailMaterial));
    }
    const wakeMaterial=new T.MeshBasicMaterial({color:'#aac8c4',transparent:true,opacity:.28,
      depthWrite:false,side:T.DoubleSide});
    effectMaterials.push(wakeMaterial);
    for(const zz of [-.51,.51]) {
      const wakeGeo=new T.PlaneGeometry(length*.82,.075);
      wakeGeo.rotateX(-Math.PI/2);
      const wake=new T.Mesh(wakeGeo,wakeMaterial);
      wake.position.set(-length*.73,-.06,zz);
      group.add(wake);
    }
    group.position.set(x,-.54,z);group.rotation.y=angle;
    scene.add(group);
    boats.push({group,centerX:x,centerZ:z,rx:large?8:7,rz:large?3.4:2.7,
      speed:large?.095:x<0?.13:-.11,phase:large?.2:x< -20?-1.35:1.15});
  }
  function boatsAndWaves() {
    // The left vessel is deliberately a modest fishing boat; no lighthouse.
    boat(-48,33,4,false,.14);boat(-12,35,5,false,-.2);boat(43,35,8,true,.03);
  }
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
    cityHouseSmokeBatch?.update(time);
    for(const {effects} of cityLandmarkModels)effects.update(time);
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
  function streetFurniture() {
    // Lighted streets make the real routes legible after dusk.
    const paths=[...mainRoads,...minorRoads];
    for(let pathIndex=0;pathIndex<paths.length;pathIndex++) {
      const road=paths[pathIndex];
      let marker=0;
      for(let i=1;i<road.p.length;i++) {
        const a=road.p[i-1],b=road.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
        for(let s=3.4;s<len;s+=5.8) {
          marker++;
          if((pathIndex+marker)%3===0)continue;
          const side=(marker%2?1:-1),offset=(road.w/2+.85)*side;
          const x=a[0]+dx*s/len-dz/len*offset;
          const z=a[1]+dz*s/len+dx/len*offset;
          if(!scenicFree(x,z,.35,true))continue;
          part('iron','cylinder',x,1.32,z,.062,2.64,.062);
          part('litWindow','dome',x,2.77,z,.2,.24,.2);
          part('roofDark','cone',x,3.0,z,.32,.24,.32);
          streetLampSites.push({x,y:heightAt(x,z)+2.77,z});
        }
      }
    }
  }
  // Keep a small, reusable set of real point lights around the camera focus.
  // Hundreds of independent lamps would create a huge fragment-shader cost;
  // the glowing glass itself remains instanced for the entire city.
  const nightEmitters=[];
  let nightMode='day';
  function createNightLights(){
    const glowMaterial=new T.SpriteMaterial({map:houseAtmosphereResources.glowMap,
      color:'#ffe0ab',transparent:true,blending:T.AdditiveBlending,
      depthWrite:false,depthTest:true,opacity:.92});
    effectMaterials.push(glowMaterial);
    for(const [kind,count] of [['lamp',9],['window',7]])for(let i=0;i<count;i++){
      const light=new T.PointLight('#ffd49a',0,kind==='lamp'?14:9,2);
      const glow=new T.Sprite(glowMaterial);
      glow.scale.setScalar(kind==='lamp'?3.5:2.15);
      light.visible=false;glow.visible=false;
      scene.add(light);scene.add(glow);
      nightEmitters.push({kind,light,glow,site:null});
    }
  }
  function updateNightLights(focus={x:0,z:-12}) {
    if(nightMode==='day')return;
    const focusX=focus.x||0,focusZ=focus.z||0;
    for(const kind of ['lamp','window']){
      const sites=kind==='lamp'?streetLampSites:windowLightSites;
      const close=sites.map(site=>({site,distance:(site.x-focusX)**2+(site.z-focusZ)**2}))
        .sort((a,b)=>a.distance-b.distance);
      const selected=[];
      for(const candidate of close){
        if(selected.length>=nightEmitters.filter(emitter=>emitter.kind===kind).length)break;
        if(selected.some(site=>(site.x-candidate.site.x)**2+(site.z-candidate.site.z)**2<
            (kind==='lamp'?25:16)))continue;
        selected.push(candidate.site);
      }
      nightEmitters.filter(emitter=>emitter.kind===kind).forEach((emitter,i)=>{
        const site=selected[i];emitter.site=site||null;
        emitter.light.visible=Boolean(site);
        emitter.glow.visible=Boolean(site);
        if(!site)return;
        emitter.light.position.set(site.x,site.y,site.z);
        emitter.glow.position.set(site.x,site.y,site.z);
        emitter.light.intensity=(kind==='lamp'?6.4:4.6)*(nightMode==='dusk'?.37:1);
        emitter.glow.material.opacity=nightMode==='dusk'?.67:.92;
      });
    }
  }
  function setNightLighting(time){
    nightMode=time;
    setBuildingAtmosphereSettings({night:time!=='day'});
    for(const {light,glow} of nightEmitters){
      light.visible=false;glow.visible=false;
    }
    if(time!=='day')updateNightLights();
  }
  function finalize() {
    const targets=[];
    for(const batch of batches.values()) {
      if(!batch.entries.length)continue;
      const mesh=new T.InstancedMesh(geometries[batch.shape],materials.get(batch.material),batch.entries.length);
      mesh.name='city-'+batch.material;
      mesh.receiveShadow=true;
      // Screen-space depth contours already define small elements; sunlight shadows on
      // each window would double the draw cost without adding readable information.
      mesh.castShadow=['box','cylinder','tower'].includes(batch.shape) && !['windows','litWindow','iron','pale','roofTile'].includes(batch.material);
      mesh.frustumCulled=false;
      for(let i=0;i<batch.entries.length;i++)mesh.setMatrixAt(i,batch.entries[i]);
      mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);targets.push(mesh);
    }
    return targets;
  }

  function finalizeSurfaces() {
    // Roads, painted shore and garden patches have world-space vertices and never move.
    // Combine them by material to avoid dozens of repeated color/normal/reflection draws.
    for(const [material,geometries] of surfaces) {
      let geometry=geometries[0];
      if(geometries.length>1) {
        const vertexCount=geometries.reduce((total,g)=>total+g.getAttribute('position').count,0);
        const indexCount=geometries.reduce((total,g)=>total+g.index.count,0);
        const positions=new Float32Array(vertexCount*3);
        const normals=new Float32Array(vertexCount*3);
        const uvs=new Float32Array(vertexCount*2);
        const indices=new (vertexCount>65535?Uint32Array:Uint16Array)(indexCount);
        let vertexOffset=0,indexOffset=0;
        for(const source of geometries) {
          const count=source.getAttribute('position').count;
          positions.set(source.getAttribute('position').array,vertexOffset*3);
          normals.set(source.getAttribute('normal').array,vertexOffset*3);
          uvs.set(source.getAttribute('uv').array,vertexOffset*2);
          const sourceIndices=source.index.array;
          for(let i=0;i<sourceIndices.length;i++)indices[indexOffset+i]=sourceIndices[i]+vertexOffset;
          indexOffset+=sourceIndices.length;
          vertexOffset+=count;
          source.dispose();
        }
        geometry=new T.BufferGeometry();
        geometry.setAttribute('position',new T.BufferAttribute(positions,3));
        geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
        geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));
        geometry.setIndex(new T.BufferAttribute(indices,1));
      }
      const mesh=new T.Mesh(geometry,material);
      mesh.name='city-merged-surface';mesh.receiveShadow=true;
      if(material===waterMats.river)mesh.userData.waterSurface=true;
      scene.add(mesh);objects.push(mesh);
    }
    surfaces.clear();
  }

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
      const model=createHouseModel(T,config,{detail:'low'});
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
    setHouseGlassAppearance(T,{gloss:buildingSettings.glassGloss,reflection:buildingSettings.glassReflection,
      night:buildingSettings.night,glow:buildingSettings.windowGlow,envMap:buildingGlassEnvironment?.texture??null});
    for(const {model,effects} of cityLandmarkModels){
      model.setWindowAppearance({gloss:buildingSettings.glassGloss,reflection:buildingSettings.glassReflection,
        night:buildingSettings.night,glow:buildingSettings.windowGlow,envMap:buildingGlassEnvironment?.texture??null});
      effects.setSettings(buildingSettings);
    }
  }

  const waterMats=landAndSea();
  infrastructure(waterMats);
  populateCityHouseLots({random,atPolyline,riverPoints,isBuildable,
    occupiedLots,newHousePlacements,houseEntrances,windowLightSites,
    heightAt,foundationDepth,local});
  connectHousePaths({
    mainRoads,minorRoads,houseEntrances,occupiedLots,riverPoints,
    atPolyline,clamp,coast,ROOT_COORDINATES,housePaths,
    ribbon,pavedRoadHeight,roadStairs,
  });
  factoryComplex();agriculturalFields();countrysideWindmill();
  addDetailedBuildings();upperCityGarden();oldTownMarket();portAndQuays();
  gardensAndTrees();hillsideLandscaping();riverbankLandscaping();greenOutskirts();streetFurniture();boatsAndWaves();
  const surfaceStats={before:[...surfaces.values()].reduce((total,group)=>total+group.length,0),after:surfaces.size};
  const hits=finalize();
  finalizeSurfaces();
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
    roadNetwork:[...mainRoads,...minorRoads],riverPoints,bridgeLocations:bridges,
    bridgeProfiles,factorySites,fieldPlots,pierLayouts,riverWidth,waterfrontWarehouses,stairRuns,palaceEntrySteps,palaceWindowPanes,
    windmillRotor,
    roadSurfaceHeight:pavedRoadHeight,terrainSurfaceHeight:terrainSurfaceAt,riverSurfaceHeight,
    nightLightSites:{lamps:streetLampSites,windows:windowLightSites},
    setNightLighting,updateNightLights,setBuildingAtmosphereSettings,
    setWaterTime:time=>waterMats.setTime(time),
    setWaterView:eye=>waterMats.setView(eye),
    setWaterLighting:time=>waterMats.setTimeOfDay(time),
    dispose() {
      for(const mesh of hits){scene.remove(mesh);mesh.dispose();}
      for(const obj of objects){scene.remove(obj);obj.geometry?.dispose();}
      if(cityHouseSmokeBatch){scene.remove(cityHouseSmoke);cityHouseSmokeBatch.dispose();}
      for(const {effects,model} of cityLandmarkModels){scene.remove(effects.group);effects.dispose();model.dispose();}
      for(const model of cityHouseModels)model.dispose();
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
