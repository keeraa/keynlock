import {LANDSCAPE_BOUNDS,RIVER_BANK_WIDTH} from './landscape-model.js';
import {keynlockCoastCrossesTile} from './keynlock-geography.js';

// Keep 24-metre base cells after resizing the world, refining only riverbanks,
// canals and hills. The lowered waterbed needs 6-metre coastal cells: at 12 m,
// one shoreline vertex can pull an entire triangle down into a pointed cliff.
const COLUMNS=110,ROWS=75,CELL=24,MAX_QUADS=34000;
const WIDTH=LANDSCAPE_BOUNDS.width,DEPTH=LANDSCAPE_BOUNDS.depth;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const index=(x,z)=>z*COLUMNS+x;

export function terrainSubdivisionStats(landscape={}){
  const levels=new Uint8Array(COLUMNS*ROWS);levels.fill(1);
  let active=0;
  for(let iz=0;iz<ROWS;iz++)for(let ix=0;ix<COLUMNS;ix++){
    const x=-WIDTH/2+(ix+.5)*CELL,z=-DEPTH/2+(iz+.5)*CELL;
    if(keynlockCoastCrossesTile(x,z,CELL/2)){
      levels[index(ix,iz)]=4;active++;
    }
  }
  function mark(x,z,radius,subdivisions){
    const left=clamp(Math.floor((x-radius+WIDTH/2)/CELL),0,COLUMNS-1);
    const right=clamp(Math.floor((x+radius+WIDTH/2)/CELL),0,COLUMNS-1);
    const top=clamp(Math.floor((z-radius+DEPTH/2)/CELL),0,ROWS-1);
    const bottom=clamp(Math.floor((z+radius+DEPTH/2)/CELL),0,ROWS-1);
    for(let iy=top;iy<=bottom;iy++)for(let ix=left;ix<=right;ix++){
      const cx=-WIDTH/2+(ix+.5)*CELL,cz=-DEPTH/2+(iy+.5)*CELL;
      if(Math.hypot(cx-x,cz-z)>radius+CELL*.71)continue;
      const at=index(ix,iy);
      if(levels[at]<subdivisions){if(levels[at]===1)active++;levels[at]=subdivisions;}
    }
  }
  for(const hill of landscape.hills||[]){
    mark(hill.x,hill.z,hill.radius+CELL*1.5,4);
  }
  for(const river of landscape.rivers||[]){
    const radius=river.width/2+RIVER_BANK_WIDTH+CELL*1.5;
    for(let i=1;i<river.points.length;i++){
      const a=river.points[i-1],b=river.points[i];
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const samples=Math.max(1,Math.ceil(length/(CELL/2)));
      for(let k=0;k<=samples;k++){
        const t=k/samples;
        mark(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,radius,8);
      }
    }
  }
  const quadCount=()=>levels.reduce((total,s)=>total+s*s,0);
  let quads=quadCount();
  // A heavily drawn city may touch every quadrant. Demote the global LOD
  // gradually rather than allowing the GPU budget to explode again.
  for(const detail of [8,4,2]){
    if(quads<=MAX_QUADS)break;
    for(let i=0;i<levels.length;i++)if(levels[i]===detail)levels[i]=detail/2;
    quads=quadCount();
  }
  return {levels,activeTiles:active,quads,triangles:quads*2,
    baseTriangles:COLUMNS*ROWS*2,maxTriangles:MAX_QUADS*2};
}

export function createTerrainMeshGeometry(THREE,landscape={}){
  const profile=terrainSubdivisionStats(landscape),positions=[],uvs=[],indices=[],stitches=[];
  for(let tileZ=0;tileZ<ROWS;tileZ++)for(let tileX=0;tileX<COLUMNS;tileX++){
    const subdivisions=profile.levels[index(tileX,tileZ)];
    const west=tileX?profile.levels[index(tileX-1,tileZ)]:subdivisions;
    const east=tileX<COLUMNS-1?profile.levels[index(tileX+1,tileZ)]:subdivisions;
    const north=tileZ?profile.levels[index(tileX,tileZ-1)]:subdivisions;
    const south=tileZ<ROWS-1?profile.levels[index(tileX,tileZ+1)]:subdivisions;
    const start=positions.length/3;
    for(let iz=0;iz<=subdivisions;iz++)for(let ix=0;ix<=subdivisions;ix++){
      const x=-WIDTH/2+(tileX+ix/subdivisions)*CELL;
      const y=-DEPTH/2+(tileZ+iz/subdivisions)*CELL;
      positions.push(x,y,0);
      uvs.push((x+WIDTH/2)/WIDTH,(y+DEPTH/2)/DEPTH);
      // Independent LOD tiles must share exactly the same border silhouette.
      // Fine edge vertices that fall between coarse vertices are projected
      // onto the coarse edge (T-junction stitching), preventing daylight-thin
      // cracks and white triangular gaps when hills/riverbanks are edited.
      const stitch=(coarse,progress,alongX)=>{
        if(coarse>=subdivisions)return;
        const scaled=progress*coarse/subdivisions,segment=Math.floor(scaled),t=scaled-segment;
        if(t<1e-7||t>1-1e-7)return;
        const a=alongX?[-WIDTH/2+(tileX+segment/coarse)*CELL,y]:
          [x,-DEPTH/2+(tileZ+segment/coarse)*CELL];
        const b=alongX?[a[0]+CELL/coarse,y]:[x,a[1]+CELL/coarse];
        stitches.push({vertex:start+iz*(subdivisions+1)+ix,a,b,t});
      };
      if(ix===0)stitch(west,iz,false);
      else if(ix===subdivisions)stitch(east,iz,false);
      if(iz===0)stitch(north,ix,true);
      else if(iz===subdivisions)stitch(south,ix,true);
    }
    const row=subdivisions+1;
    for(let iz=0;iz<subdivisions;iz++)for(let ix=0;ix<subdivisions;ix++){
      const a=start+iz*row+ix,b=a+1,c=a+row,d=c+1;
      indices.push(a,b,d,a,d,c);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));
  geometry.userData.terrainStats={triangles:profile.triangles,activeTiles:profile.activeTiles};
  geometry.userData.terrainStitches=stitches;
  return geometry;
}

export function updateTerrainMeshGeometry(geometry,heightAt,{regions=null}={}){
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  const affects=(x,z)=>!regions||regions.some(region=>
    x>=region.minX&&x<=region.maxX&&z>=region.minZ&&z<=region.maxZ);
  let updated=0;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=-position.getY(i);
    if(!affects(x,z))continue;
    const y=heightAt(x,z),dx=(heightAt(x+1,z)-heightAt(x-1,z))*.5;
    const dz=(heightAt(x,z+1)-heightAt(x,z-1))*.5;
    const inverse=1/Math.hypot(dx,dz,1);
    position.setZ(i,y);
    // Local plane XY becomes world X,-Z after rotation -90° around X.
    normal.setXYZ(i,-dx*inverse,dz*inverse,inverse);
    updated++;
  }
  const edgeNormal=point=>{
    const x=point[0],z=-point[1];
    const dx=(heightAt(x+1,z)-heightAt(x-1,z))*.5;
    const dz=(heightAt(x,z+1)-heightAt(x,z-1))*.5;
    const inv=1/Math.hypot(dx,dz,1);
    return [-dx*inv,dz*inv,inv];
  };
  for(const {vertex,a,b,t} of geometry.userData.terrainStitches||[]){
    if(!affects(position.getX(vertex),-position.getY(vertex)))continue;
    const height=heightAt(a[0],-a[1])*(1-t)+heightAt(b[0],-b[1])*t;
    position.setZ(vertex,height);
    // Match the interpolated lighting across the shared border as well as
    // the geometry, so a repaired crack does not become a dark LOD stripe.
    const first=edgeNormal(a),second=edgeNormal(b);
    const nx=first[0]*(1-t)+second[0]*t,
      ny=first[1]*(1-t)+second[1]*t,nz=first[2]*(1-t)+second[2]*t;
    const inverse=1/Math.hypot(nx,ny,nz);
    normal.setXYZ(vertex,nx*inverse,ny*inverse,nz*inverse);
  }
  if(updated){position.needsUpdate=true;normal.needsUpdate=true;geometry.computeBoundingSphere();}
  geometry.userData.lastUpdatedVertices=updated;
  return geometry;
}

// The river/hill topology only changes when the landscape is edited. Buildings
// move much more often: refresh their foundation heights in the existing GPU
// buffers instead of rebuilding the whole triangulation each drag frame.
export function createTerrainMeshUpdater(THREE){
  let geometry=createTerrainMeshGeometry(THREE),lastTerrainKey=null,lastPads=null;
  const padRegion=building=>{
    const c=Math.abs(Math.cos(building.rotation||0)),s=Math.abs(Math.sin(building.rotation||0));
    const halfX=((building.width||0)*c+(building.depth||0)*s)/2+4;
    const halfZ=((building.depth||0)*c+(building.width||0)*s)/2+4;
    return {minX:building.x-halfX,maxX:building.x+halfX,
      minZ:building.z-halfZ,maxZ:building.z+halfZ};
  };
  const padsFor=buildings=>new Map(buildings.map(building=>[building.id,{
    key:JSON.stringify([building.x,building.z,building.width,building.depth,building.rotation||0]),
    region:padRegion(building),
  }]));
  return {
    get geometry(){return geometry;},
    update(landscape,heightAt,buildings){
      // Bridges change the network and paving, but not the shape of the soil.
      // Only edits to streams/hills change terrain tessellation.
      const terrainKey=JSON.stringify([landscape.rivers||[],landscape.hills||[]]);
      const pads=buildings?padsFor(buildings):null;
      if(lastTerrainKey!==terrainKey){
        const next=createTerrainMeshGeometry(THREE,landscape);
        updateTerrainMeshGeometry(next,heightAt);
        geometry.dispose();geometry=next;lastTerrainKey=terrainKey;
      }else if(!pads||!lastPads){
        updateTerrainMeshGeometry(geometry,heightAt);
      }else{
        const regions=[];
        for(const [id,pad] of lastPads)if(pads.get(id)?.key!==pad.key)regions.push(pad.region);
        for(const [id,pad] of pads)if(lastPads.get(id)?.key!==pad.key)regions.push(pad.region);
        if(regions.length)updateTerrainMeshGeometry(geometry,heightAt,
          regions.length>12?{}:{regions});
        else geometry.userData.lastUpdatedVertices=0;
      }
      lastPads=pads;
      return geometry;
    },
    dispose(){geometry.dispose();},
  };
}
