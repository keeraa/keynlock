/** Continuous town relief; every road and foundation samples this same surface. */
const smoothstep=(a,b,value)=>{
  const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
  return t*t*(3-2*t);
};

// Shared northern silhouette; rivers must start inside this edge, not as
// rectangular ribbons floating outside the mapped landmass.
export const northTerrainEdge=x=>-94+2.1*Math.sin(x*.066+.7)+.85*Math.sin(x*.19);

function distanceToPath(x,z,points) {
  let nearest=Infinity;
  for(let i=1;i<points.length;i++) {
    const [ax,az]=points[i-1],[bx,bz]=points[i];
    const dx=bx-ax,dz=bz-az;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    nearest=Math.min(nearest,Math.hypot(x-(ax+dx*t),z-(az+dz*t)));
  }
  return nearest;
}

export function makeHeightSampler(coast,riverPath) {
  return (x,z)=>{
    const distance=coast(x)-z;
    if(distance<0)return 0;
    const fade=smoothstep(0,12,distance);
    const rolling=.57+.29*Math.sin(x*.105+z*.048)+.23*Math.cos(z*.16-x*.056)
      +.16*Math.sin(x*.21-z*.14)+.065*Math.sin(x*.37+z*.29);
    const uphill=.82*smoothstep(7,65,distance);
    const eastHill=1.15*Math.exp(-Math.pow((x-40)/26,2)-Math.pow((z+33)/22,2));
    const westHill=.54*Math.exp(-Math.pow((x+46)/19,2)-Math.pow((z+36)/23,2));
    const distantHills=1.45*smoothstep(57,112,distance)*(.7+.3*Math.sin(x*.062-z*.055));
    // Give the water a genuine, gently sloping bed right up to its banks.
    // A narrow channel used to let the ground pierce the water edges.
    const riverDistance=distanceToPath(x,z,riverPath);
    const channel=.94*(1-smoothstep(4.8,9.0,riverDistance));
    const bankRise=.28*Math.exp(-Math.pow((riverDistance-7.4)/2.7,2));
    const normalHeight=Math.max(.025,fade*(rolling+uphill+eastHill+westHill+distantHills-channel+bankRise));
    // The palace sits on a twice-higher hill. A broad transition gives the
    // access road a continuous slope and keeps the castle foundations grounded.
    const castleHill=4.0*Math.exp(-Math.pow((x-5)/32,2)-Math.pow((z+57)/27,2));
    const elevatedLand=normalHeight*3+castleHill;
    const palaceDistance=Math.max(Math.abs(x-5),Math.abs(z+57)*1.38);
    // Southern bridges keep their own shallow approach grades; the higher
    // plateau emerges only beyond the inland residential boulevard.
    const riverValley=smoothstep(4.5,18,distanceToPath(x,z,riverPath));
    // Spread the steep change of level across the whole lower hillside. This
    // gives paths room for shallow stair flights and keeps their foundations
    // in the actual terrain rather than perched against a sudden cliff.
    const oldPlateau=(1-smoothstep(16,69,palaceDistance))*(1-smoothstep(-43,-27,z))*riverValley;
    const gentlePlateau=(1-smoothstep(15,75,palaceDistance))*(1-smoothstep(-47,-13,z))*riverValley;
    const approachCorridor=1-smoothstep(12,24,Math.abs(x-5));
    const plateau=oldPlateau*(1-approachCorridor)+gentlePlateau*approachCorridor;
    const raisedLand=elevatedLand*(1-plateau)+26.4*plateau;
    // Cut the estuary below sea level. The old continuous land rim at z=coast
    // formed a narrow dam even after the river material faded into the ocean.
    const mouth=(1-smoothstep(3,12,distance))*
      (1-smoothstep(3.0,5.8,distanceToPath(x,z,riverPath)));
    return raisedLand*(1-mouth)-.67*mouth;
  };
}

/** Tessellated ground with a softly irregular skyline, natural shore and solid edge skirts. */
export function createTerrainMeshes(THREE,material,coast,heightAt) {
  material.side=THREE.DoubleSide;
  const north=northTerrainEdge;
  // The countryside continues behind the factories and palace, with a distant rolling skyline.
  const WEST=-116,EAST=116,nx=208,nz=124;
  const positions=[],uvs=[],indices=[];
  const xAt=(ix,iz)=>{
    const t=ix/nx,edge=Math.pow(Math.abs(t*2-1),8);
    return WEST+(EAST-WEST)*t+edge*Math.sin(iz*.11+t*1.7)*2.6;
  };
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++) {
    const x=xAt(ix,iz);
    const z=north(x)+(coast(x)-north(x))*iz/nz;
    positions.push(x,heightAt(x,z),z);
    uvs.push(x-WEST,z+50);
  }
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++) {
    const a=iz*(nx+1)+ix,b=a+1,c=a+nx+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const land=new THREE.Mesh(geometry,material);
  land.name='city-terrain';land.receiveShadow=true;

  // Roads are drawn above this *triangulated* surface, not the continuous
  // height formula. On the steep palace slope those two previously differed
  // enough to make the ground cut triangular holes through the paving.
  const vertexData=geometry.getAttribute('position').array;
  const sampleTriangle=(x,z,ai,bi,ci)=>{
    const ax=vertexData[ai*3],az=vertexData[ai*3+2];
    const bx=vertexData[bi*3],bz=vertexData[bi*3+2];
    const cx=vertexData[ci*3],cz=vertexData[ci*3+2];
    const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if(Math.abs(denominator)<1e-8)return null;
    const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator;
    const b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator;
    const c=1-a-b;
    if(Math.min(a,b,c)<-1e-5)return null;
    return a*vertexData[ai*3+1]+b*vertexData[bi*3+1]+c*vertexData[ci*3+1];
  };
  const surfaceHeightAt=(x,z)=>{
    const ix=Math.floor((x-WEST)/(EAST-WEST)*nx);
    const iz=Math.floor((z-north(x))/(coast(x)-north(x))*nz);
    const searchRadius=Math.abs(x)>102?4:2;
    for(let j=Math.max(0,iz-searchRadius);j<=Math.min(nz-1,iz+searchRadius);j++) {
      for(let i=Math.max(0,ix-searchRadius);i<=Math.min(nx-1,ix+searchRadius);i++) {
        const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
        const first=sampleTriangle(x,z,a,c,b);
        if(first!==null)return first;
        const second=sampleTriangle(x,z,b,c,d);
        if(second!==null)return second;
      }
    }
    // Far beyond the finite painted terrain, retain the original sampler.
    return heightAt(x,z);
  };

  const strips=[];
  const addEdge=coords=>{
    const edgePositions=[],edgeUvs=[],edgeIndices=[];
    coords.forEach(([x,z],i)=>{
      edgePositions.push(x,heightAt(x,z)-.015,z,x,-.72,z);
      edgeUvs.push(i*.55,0,i*.55,1);
      if(i) {
        const a=(i-1)*2,b=i*2;
        edgeIndices.push(a,b,a+1,a+1,b,b+1);
      }
    });
    const edgeGeometry=new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));
    edgeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(edgeUvs,2));
    edgeGeometry.setIndex(edgeIndices);edgeGeometry.computeVertexNormals();
    strips.push(edgeGeometry);
  };
  const top=[],left=[],right=[];
  const at=(ix,iz)=>{
    const p=(iz*(nx+1)+ix)*3;
    return [positions[p],positions[p+2]];
  };
  for(let i=0;i<=nx;i++){
    top.push(at(i,0));
  }
  for(let i=0;i<=nz;i++){
    left.push(at(0,i));right.push(at(nx,i));
  }
  // The sea covers the coast edge. Its old vertical skirt appeared as a long
  // outlined black stripe below the quay and closed the estuary again.
  for(const edge of [top,left,right])addEdge(edge);
  const skirts=strips.map(g=>{
    const mesh=new THREE.Mesh(g,material);
    mesh.name='city-terrain-edge';mesh.receiveShadow=true;
    return mesh;
  });
  return {land,skirts,surfaceHeightAt};
}
