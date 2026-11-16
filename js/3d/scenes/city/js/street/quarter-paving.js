// Procedural stone streets follow the generated road graph, including bends,
// crooked crossings and irregular lanes. Cobble/paver instances are combined
// across the whole block to keep GPU draw calls independent of stone count.
import { junctionArms,junctionContainsStone,junctionSidewalkCorners } from './quarter-junctions.js';
import { buildQuarterRoadAtlas } from './quarter-road-atlas.js';

export function buildQuarterPaving(THREE,root,plan) {
  const materials={
    earth:new THREE.MeshStandardMaterial({color:'#d8ccb3',roughness:1}),
    cobble:new THREE.MeshStandardMaterial({color:'#999184',roughness:1}),
    paving:new THREE.MeshStandardMaterial({color:'#bcb19b',roughness:1,side:THREE.DoubleSide}),
    walk:new THREE.MeshStandardMaterial({color:'#cfc3a8',roughness:1,side:THREE.DoubleSide}),
    curb:new THREE.MeshStandardMaterial({color:'#d8c6a6',roughness:1,side:THREE.DoubleSide}),
    dirt:new THREE.MeshStandardMaterial({color:'#ab9b7e',roughness:1,side:THREE.DoubleSide}),
    tree:new THREE.MeshStandardMaterial({color:'#6a8057',roughness:1,flatShading:true}),
    trunk:new THREE.MeshStandardMaterial({color:'#6a533f',roughness:1}),
  };
  const box=(parent,w,h,l,x,y,z,material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),material);
    mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  box(root,230,.2,220,0,-.25,0,materials.earth);
  const nodeMap=new Map(plan.roads.nodes.map(node=>[node.id,node]));
  const lineById=new Map(plan.roads.lines.map(line=>[line.id,line]));
  const nodeWidth=node=>Math.max(...node.roads.map(id=>lineById.get(id).width));
  const nodeTrim=node=>nodeWidth(node)/2+Math.max(...node.roads.map(id=>lineById.get(id).walkWidth))*.75+.34;
  const stones={cobble:[],paving:[]};

  const offsetAt=(path,i,offset)=>{
    const perp=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;return [-dz/len,dx/len];};
    const before=i===0?perp(path[0],path[1]):perp(path[i-1],path[i]);
    const after=i===path.length-1?before:perp(path[i],path[i+1]);
    const mx=before[0]+after[0],mz=before[1]+after[1],length=Math.hypot(mx,mz)||1;
    const nx=mx/length,nz=mz/length,miter=offset/Math.max(.5,nx*after[0]+nz*after[1]);
    return [path[i][0]+nx*miter,path[i][1]+nz*miter];
  };
  const ribbon=(path,width,offset,top,bottom,material)=>{
    if(path.length<2)return;
    const vertices=[],indices=[];
    path.forEach((_,i)=>{
      const left=offsetAt(path,i,offset+width/2),right=offsetAt(path,i,offset-width/2);
      vertices.push(left[0],top,left[1],right[0],top,right[1],
        left[0],bottom,left[1],right[0],bottom,right[1]);
      if(i===0)return;
      const p=(i-1)*4,q=i*4;
      indices.push(p,p+1,q+1,p,q+1,q, p,p+2,q+2,p,q+2,q,
        p+1,q+1,q+3,p+1,q+3,p+3);
    });
    indices.push(0,2,3,0,3,1);
    const last=(path.length-1)*4;indices.push(last,last+1,last+3,last,last+3,last+2);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;root.add(mesh);
  };
  const trimmedSections=line=>{
    const path=line.path,distances=[0],firstNode=nodeMap.get(`${path[0][0]}:${path[0][1]}`);
    const markers=[{d:0,cut:firstNode?.roads.length>1,radius:firstNode?.roads.length>1?nodeTrim(firstNode):0}];
    for(let i=1;i<path.length;i++){
      distances[i]=distances[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);
      const node=nodeMap.get(`${path[i][0]}:${path[i][1]}`);
      if(node?.roads.length>1||i===path.length-1)markers.push({d:distances[i],cut:node?.roads.length>1,
        radius:node?.roads.length>1?nodeTrim(node):0});
    }
    const at=d=>{
      for(let i=1;i<path.length;i++)if(d<=distances[i]||i===path.length-1){
        const t=Math.max(0,Math.min(1,(d-distances[i-1])/(distances[i]-distances[i-1])));
        return [path[i-1][0]+(path[i][0]-path[i-1][0])*t,path[i-1][1]+(path[i][1]-path[i-1][1])*t];
      }
      return path.at(-1);
    };
    return markers.slice(1).map((end,i)=>{
      const start=markers[i],from=start.d+(start.cut?start.radius:0);
      const to=end.d-(end.cut?end.radius:0);
      return to-from>1.5?[at(from),...path.filter((_,j)=>distances[j]>from&&distances[j]<to),at(to)]:[];
    }).filter(part=>part.length>=2);
  };

  // Batch world-space stone matrices from many road groups into two draws.
  const tile=(parent,w,l,kind,seed,y=.082,clip=0)=>{
    const sizeX=kind==='cobble'?.72:1.05,sizeZ=kind==='cobble'?.48:1.1;
    const cols=Math.floor((w-.12)/sizeX),rows=Math.floor((l-.12)/sizeZ);
    if(cols<1||rows<1)return;
    let state=seed>>>0;
    const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    parent.updateWorldMatrix(true,false);
    const pos=new THREE.Vector3();
    const rotation=new THREE.Euler().setFromQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()),'YXZ');
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      const stagger=kind==='cobble'&&row%2?sizeX*.35:0;
      const localX=-w/2+(col+.5)*sizeX+stagger;
      const localZ=-l/2+(row+.5)*sizeZ;
      if(typeof clip==='function'&&!clip(localX,localZ))continue;
      if(typeof clip==='number'&&clip>0&&Math.hypot(localX,localZ)>clip-.25)continue;
      pos.set(localX,y+(random()-.5)*.009,localZ).applyMatrix4(parent.matrixWorld);
      stones[kind].push({x:pos.x,y:pos.y,z:pos.z,yaw:rotation.y+(random()-.5)*.035,
        tint:.87+random()*.22});
    }
  };
  const stoneKind=plan.profile.surface==='paving'?'paving':'cobble';
  let tileSeed=(plan.seed>>>0)+127;

  // Prefer a single continuous painted surface in browsers. The lightweight
  // geometry path below remains available to headless geometry consumers.
  const hasRoadAtlas=buildQuarterRoadAtlas(THREE,root,plan);
  if(!hasRoadAtlas){

  for(const [index,line] of plan.roads.lines.entries()){
    // A sub-millimetre layer order avoids coplanar depth flicker at crossings.
    ribbon(line.path,line.width,0,.051+index*.0015,-.015,materials.dirt);
    for(const part of trimmedSections(line))for(const side of [-1,1]){
      ribbon(part,line.walkWidth,side*(line.width/2+line.walkWidth/2),.21,.015,materials.walk);
      ribbon(part,.16,side*(line.width/2+.07),.244,.04,materials.curb);
    }
  }

  // Round off the sidewalk corners at every junction. Their boundaries meet
  // the trimmed approach ribbons exactly, including T-shaped junctions.
  for(const junction of plan.roads.junctions){
    const arms=junctionArms(plan,junction);
    for(const [index,corner] of junctionSidewalkCorners(arms).entries()){
      const shape=new THREE.Shape();
      corner.polygon.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
      shape.closePath();
      const geometry=new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI/2);
      const mesh=new THREE.Mesh(geometry,materials.walk);
      mesh.position.set(junction.x,.211,junction.z);
      mesh.receiveShadow=true;
      mesh.userData.junctionCorner={node:junction.id,index};
      root.add(mesh);
      const curbPath=corner.curb.map(([x,z])=>[junction.x+x,junction.z+z]);
      ribbon(curbPath,.16,0,.245,.04,materials.curb);
    }
  }

  for(const edge of plan.roads.edges){
    const from=nodeMap.get(edge.from),to=nodeMap.get(edge.to);
    const dx=to.x-from.x,dz=to.z-from.z,dist=Math.hypot(dx,dz);
    const ux=dx/dist,uz=dz/dist;
    const insetA=from.roads.length>1?nodeWidth(from)/2+.16:0;
    const insetB=to.roads.length>1?nodeWidth(to)/2+.16:0;
    const length=dist-insetA-insetB;
    if(length<.9)continue;
    const mid=(insetA+length/2)/dist;
    const group=new THREE.Group();group.position.set(from.x+dx*mid,0,from.z+dz*mid);
    group.rotation.y=Math.atan2(ux,uz);root.add(group);
    tile(group,edge.width,length,stoneKind,tileSeed++);
    const walkInsetA=from.roads.length>1?nodeTrim(from):0;
    const walkInsetB=to.roads.length>1?nodeTrim(to):0;
    const walkLength=dist-walkInsetA-walkInsetB;
    if(walkLength>.9){
      const center=(walkInsetA+walkLength/2)/dist;
      const walkway=new THREE.Group();
      walkway.position.set(from.x+dx*center,0,from.z+dz*center);
      walkway.rotation.y=Math.atan2(ux,uz);root.add(walkway);
      for(const side of [-1,1]){
        const x=side*(edge.width/2+edge.walkWidth/2);
        const surface=new THREE.Group();surface.position.x=x;walkway.add(surface);
        tile(surface,edge.walkWidth,walkLength,'paving',tileSeed++,.224);
      }
    }
  }

  // A junction receives stones only inside the actual union of its crossing
  // roads: no circular roundabout blobs or painted road markings.
  for(const junction of plan.roads.junctions){
    const radius=nodeWidth(junction)*.8;
    const arms=junctionArms(plan,junction);
    const inside=(x,z)=>junctionContainsStone(x,z,arms);
    const tiling=new THREE.Group();tiling.position.set(junction.x,0,junction.z);root.add(tiling);
    tile(tiling,radius*2,radius*2,stoneKind,tileSeed++,.085,inside);
  }
  // Thousands of full BoxGeometry stones used 12 triangles each. The visible
  // top of a flagstone needs only two; cobbles retain four sloped edge facets
  // for relief at walking height (six triangles instead of twelve).
  const stoneGeometry=(kind,w,l)=>{
    if(kind==='paving'){
      const geometry=new THREE.PlaneGeometry(w,l);
      geometry.rotateX(-Math.PI/2);
      geometry.translate(0,.015,0);
      return geometry;
    }
    const x=w/2,z=l/2,y=.035;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -x,y,-z, x,y,-z, x,y,z, -x,y,z, 0,-y,0,
    ],3));
    geometry.setIndex([0,2,1,0,3,2,0,1,4,1,2,4,2,3,4,3,0,4]);
    geometry.computeVertexNormals();
    return geometry;
  };
  for(const kind of ['cobble','paving']){
    const items=stones[kind];if(!items.length)continue;
    const w=kind==='cobble'?.72:1.05,l=kind==='cobble'?.48:1.1;
    const geo=stoneGeometry(kind,w*.91,l*.9);
    const mesh=new THREE.InstancedMesh(geo,materials[kind],items.length),dummy=new THREE.Object3D();
    items.forEach((item,i)=>{
      dummy.position.set(item.x,item.y,item.z);dummy.rotation.set(0,item.yaw,0);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color().setScalar(item.tint));
    });
    mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);
  }
  }
  if(hasRoadAtlas){
    // The canvas atlas replaces both the old individual stone meshes and the
    // road ribbons; neither of these temporary materials reaches the scene.
    materials.cobble.dispose();materials.dirt.dispose();
  }

  // Doors and the public passage follow the same geometry as the roads.
  for(const walk of plan.walkways)for(let i=1;i<walk.p.length;i++){
    const [ax,az]=walk.p[i-1],[bx,bz]=walk.p[i],dx=bx-ax,dz=bz-az;
    const length=Math.hypot(dx,dz);if(length<.03)continue;
    const strip=box(root,walk.width,.045,length,(ax+bx)/2,.155,(az+bz)/2,materials.walk);
    strip.rotation.y=Math.atan2(dx,dz);
  }

  const court=plan.courtyard;
  const outline=new THREE.Shape();
  court.polygon.forEach(([x,z],i)=>i?outline.lineTo(x,-z):outline.moveTo(x,-z));outline.closePath();
  const paving=new THREE.Mesh(new THREE.ShapeGeometry(outline),materials.paving);
  paving.geometry.rotateX(-Math.PI/2);paving.position.y=.098;paving.receiveShadow=true;root.add(paving);
  // Cut entrances in the low stone edging on the two sides of the courtyard.
  for(let i=0;i<court.polygon.length;i++){
    const a=court.polygon[i],b=court.polygon[(i+1)%court.polygon.length];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    let runs=[[0,1]];
    for(const gate of court.entrances){
      const t=Math.max(0,Math.min(1,((gate[0]-a[0])*dx+(gate[1]-a[1])*dz)/(length*length)));
      const d=Math.hypot(a[0]+t*dx-gate[0],a[1]+t*dz-gate[1]);
      if(d>1.3)continue;
      const from=Math.max(0,t-1.15/length),to=Math.min(1,t+1.15/length);
      runs=runs.flatMap(([start,end])=>end<=from||start>=to?[[start,end]]:
        [[start,Math.min(end,from)],[Math.max(start,to),end]].filter(([x,y])=>y-x>.01));
    }
    for(const [start,end] of runs){
      const span=(end-start)*length;if(span<.2)continue;
      const middle=(start+end)/2;
      const border=box(root,.24,.19,span,a[0]+dx*middle,.105,a[1]+dz*middle,materials.curb);
      border.rotation.y=Math.atan2(dx,dz);
    }
  }
  box(root,1.85,.18,2.45,17.1,.13,7.8,materials.tree);
  box(root,1.75,.18,2.55,25.6,.13,8,materials.tree);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.17,.26,2.6,8),materials.trunk);
  trunk.position.set(21.2,1.63,8.6);trunk.castShadow=true;root.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.46,1),materials.tree);
  crown.position.set(21.2,3.34,8.6);crown.castShadow=true;root.add(crown);
}
