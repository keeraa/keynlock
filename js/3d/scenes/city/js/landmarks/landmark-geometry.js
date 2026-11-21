// Shared, world-space landmark primitives. Owned geometries are disposed by the model.
const ROOF_METRES_U=8;
const ROOF_METRES_V=8;
const STONE_METRES_PER_TILE=4.6;

export function createLandmarkGeometry(T,root,m,{hi,lo,paintedSurfaces}) {
  const attach=(geometry,mat,pos,rotation)=>{
    const mesh=new T.Mesh(geometry,typeof mat==='string'?m[mat]:mat);
    if(pos)mesh.position.set(...pos);
    if(rotation)mesh.rotation.set(...rotation);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const box=(x,y,z,w,h,d,mat)=>{
    const geometry=new T.BoxGeometry(w,h,d);
    if(paintedSurfaces[mat]==='stone'){
      // BoxGeometry UVs otherwise stretch the same four stone courses over a
      // 2 m plinth and a 16 m palace wing. Project in model-space metres so
      // separate box meshes keep the same courses at their shared seams.
      const uv=geometry.getAttribute('uv'),positions=geometry.getAttribute('position');
      for(let face=0;face<6;face++)for(let vertex=0;vertex<4;vertex++){
        const i=face*4+vertex;
        const u=face<2?positions.getZ(i)+z:positions.getX(i)+x;
        const v=face<2||face>=4?positions.getY(i)+y:positions.getZ(i)+z;
        uv.setXY(i,u/STONE_METRES_PER_TILE,v/STONE_METRES_PER_TILE);
      }
      uv.needsUpdate=true;
    }
    return attach(geometry,mat,[x,y,z]);
  };
  const cyl=(x,y,z,rTop,rBottom,h,mat,sides=12)=>attach(new T.CylinderGeometry(rTop,rBottom,h,sides),mat,[x,y,z]);
  const cone=(x,y,z,r,h,mat,sides=8)=>{
    const geometry=new T.ConeGeometry(r,h,sides);
    if(['roof','roofDeep','slate','slateLight'].includes(mat)){
      const uv=geometry.getAttribute('uv');
      const circumference=2*Math.PI*r,slant=Math.hypot(r,h);
      for(let i=0;i<uv.count;i++)uv.setXY(i,
        uv.getX(i)*circumference/ROOF_METRES_U,
        uv.getY(i)*slant/ROOF_METRES_V);
      uv.needsUpdate=true;
    }
    const roof=attach(geometry,mat,[x,y,z]);
    if(['roof','roofDeep','slate','slateLight'].includes(mat))roof.userData.landmarkRoofSurface=true;
    // A four-sided roof's corners belong above the tower's corners.
    if(sides===4)roof.rotation.y=Math.PI/4;
    return roof;
  };
  const ball=(x,y,z,r,mat,segments=14)=>attach(new T.SphereGeometry(r,segments,Math.max(7,segments/2)),mat,[x,y,z]);
  const beam=(a,b,r,mat,sides=6)=>{
    const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
    const mesh=attach(new T.CylinderGeometry(r,r,delta.length(),sides),mat,start.clone().add(end).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;
  };
  const wedge=(x,y,z,w,d,rise,mat,eaves=.45,gableMaterial='stone')=>{
    // Two pitch faces plus the triangular end caps. y marks the wall plate.
    const left=x-w/2-eaves,right=x+w/2+eaves,front=z+d/2+eaves,back=z-d/2-eaves;
    const ridge=y+rise,edge=y-.15;
    const vertex=[left,edge,front,x,ridge,front,left,edge,back,x,ridge,back,
      x,ridge,front,right,edge,front,x,ridge,back,right,edge,back];
    const faces=[0,2,1,1,2,3,4,5,6,5,7,6];
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertex,3));
    // Constant paint scale on short and long roofs. Rows follow the ridge;
    // a tile keeps its size when the roof span changes between landmarks.
    const halfWidth=w/2+eaves,slant=Math.hypot(halfWidth,rise+.15);
    geometry.setAttribute('uv',new T.Float32BufferAttribute(Array.from({length:vertex.length/3},(_,i)=>[
      (vertex[i*3+2]-back)/ROOF_METRES_U,
      (1-Math.abs(vertex[i*3]-x)/halfWidth)*slant/ROOF_METRES_V,
    ]).flat(),2));
    geometry.setIndex(faces);geometry.computeVertexNormals();
    const roof=attach(geometry,mat);roof.userData.landmarkRoofSurface=true;
    // Seal the paper-thin painted roof at the eave to prevent daylight gaps
    // when viewed from beneath the auditorium and stage roofs.
    const soffit=box(x,edge-.105,z,w+eaves*2,.21,d+eaves*2,'roofTrim');
    soffit.userData.landmarkRoofSoffit=true;
    for(const s of [-1,1]){
      const zz=s===1?front:back;
      // Both gable ends need outward-facing triangles and actual paint UVs.
      // One-sided, UV-less caps disappeared from behind the theater, exposing
      // the sky through the roof's triangular ends.
      const capG=new T.BufferGeometry();
      capG.setAttribute('position',new T.Float32BufferAttribute([
        left,edge,zz,right,edge,zz,x,ridge,zz,
        left,edge,zz,x,ridge,zz,right,edge,zz,
      ],3));
      capG.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,1,0,0,.5,1,1,0],2));
      capG.computeVertexNormals();
      const cap=attach(capG,gableMaterial);
      cap.userData.landmarkRoofGable=true;
    }
    if(!lo){
      const trim=mat.startsWith('slate')?'slateTrim':'roofTrim';
      for(const zz of [front,back]){
        beam([left,edge,zz],[x,ridge,zz],.075,trim);
        beam([x,ridge,zz],[right,edge,zz],.075,trim);
      }
      beam([x,ridge,front],[x,ridge,back],.09,trim);
    }
  };
  const hipRoof=(x,y,z,w,d,rise,mat)=>{
    // Mansard-like shallow hipped roof with a rectangular top ridge.
    const hw=w/2+.45,hd=d/2+.45,rz=Math.max(.05,hd-Math.min(hw,hd)*.65);
    const verts=[[-hw,y,z+hd],[hw,y,z+hd],[hw,y,z-hd],[-hw,y,z-hd],[0,y+rise,z+rz],[0,y+rise,z-rz]];
    const tris=[[0,1,4],[3,5,2],[0,4,5],[0,5,3],[1,2,5],[1,5,4]];
    const geometry=new T.BufferGeometry();const points=tris.flatMap(tri=>tri.flatMap(i=>[verts[i][0]+x,verts[i][1],verts[i][2]]));
    geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
    const frontSlant=Math.hypot(hd-rz,rise),sideSlant=Math.hypot(hw,rise);
    const uvs=tris.flatMap((tri,face)=>tri.flatMap(i=>{
      const [vx,vy,vz]=verts[i];
      const endFace=face<=1; // triangular front/back: rows parallel to X
      const along=endFace?vx+hw:vz-z+hd;
      const slope=endFace?frontSlant:sideSlant;
      const riseFraction=(vy-y)/rise;
      return [along/ROOF_METRES_U,riseFraction*slope/ROOF_METRES_V];
    }));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    const roof=attach(geometry,mat);roof.userData.landmarkRoofSurface=true;
    if(!lo){
      const trim=mat.startsWith('slate')?'slateTrim':'roofTrim';
      // Fascia and hip battens hide the join between differently pitched
      // painted planes, including their intentionally repeated tile pattern.
      box(x,y+.08,z+hd,w+.7,.18,.16,trim);
      box(x,y+.08,z-hd,w+.7,.18,.16,trim);
      for(const sx of [-1,1]){
        box(x+sx*hw,y+.08,z,.16,.18,d+.7,trim);
        for(const sz of [-1,1])beam(
          [x+sx*hw,y,z+sz*hd],
          [x,y+rise,z+sz*rz],
          .08,trim);
      }
    }
    return roof;
  };
  const archShape=(w,h)=>{
    const sh=new T.Shape(),s=Math.min(w*.49,h*.31);
    sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-s);
    sh.absellipse(0,h-s,w/2,s,0,Math.PI,false,0);sh.lineTo(-w/2,0);
    return sh;
  };
  const archSurround=(w,h,segments)=>{
    // The casing follows precisely the same elliptical crown as archShape.
    // The former Catmull-Rom tube overshot at both shoulders, leaving broken
    // corners and an asymmetrical arch on every landmark's entrances/windows.
    const rise=Math.min(w*.49,h*.31),spring=h-rise;
    const points=[[-w/2,0],[-w/2,spring]];
    for(let i=1;i<=segments;i++){
      const theta=Math.PI-i*Math.PI/segments;
      points.push([Math.cos(theta)*w/2,spring+Math.sin(theta)*rise]);
    }
    points.push([w/2,0]);
    const vertices=[],uvs=[],indices=[];
    const distance=[0];
    for(let i=1;i<points.length;i++)distance.push(distance.at(-1)+Math.hypot(
      points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    for(let i=0;i<points.length;i++){
      const prev=points[Math.max(i-1,0)],next=points[Math.min(i+1,points.length-1)];
      const dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy);
      const nx=-dy/len,ny=dx/len,[x,y]=points[i];
      // Four connected corners per cross-section: masonry, front bevel,
      // inner reveal. The back edge enters the wall and the glass panel.
      for(const [offset,z,v] of [[-.035,.018,0],[.125,.018,.3],[.125,.115,.7],[-.035,.115,1]]){
        vertices.push(x+nx*offset,y+ny*offset,z);
        uvs.push(distance[i]/distance.at(-1),v);
      }
      if(i===points.length-1)continue;
      const a=i*4,b=a+4;
      for(const [j,k] of [[0,1],[1,2],[2,3]]){
        indices.push(a+j,a+k,b+j,b+j,a+k,b+k);
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return geometry;
  };
  const arch=(x,y,z,w,h,{glass='glass',frame='ivory',entrance=false,side=0,mullions=hi,decoration=hi}={})=>{
    // Every facade opening is seated on the nearest solid wall. Formerly the
    // hand-authored offsets differed by up to 20 cm between building types,
    // leaving entire windows and their surrounds suspended off the masonry.
    const middleY=y+h*.5;
    let wallFace=null,closest=.4;
    for(const wall of root.children){
      if(!wall.isMesh||wall.geometry.type!=='BoxGeometry')continue;
      const {width:ww,height:wh,depth:wd}=wall.geometry.parameters;
      if(ww<3||wh<3||wd<2.5||Math.abs(middleY-wall.position.y)>wh/2+.05)continue;
      if(side?Math.abs(z-wall.position.z)>wd/2-w*.15:
        Math.abs(x-wall.position.x)>ww/2-w*.15)continue;
      const face=side?wall.position.x+side*ww/2:wall.position.z+wd/2;
      const difference=Math.abs((side?x:z)-face);
      if(difference<closest){closest=difference;wallFace=face;}
    }
    const local=new T.Group();
    // Keep painted frames a hair in front of the facade, including at the
    // curved shoulders; otherwise masonry intermittently masks their edge.
    local.position.set(side&&wallFace!==null?wallFace-side*.002:x,y,
      !side&&wallFace!==null?wallFace-.002:z);
    local.userData.landmarkOpeningWidth=w;
    local.userData.landmarkOpeningHeight=h;
    if(side)local.rotation.y=side*Math.PI/2;
    root.add(local);
    const shape=archShape(w,h),panelGeometry=new T.ShapeGeometry(shape,lo?6:14);
    // ShapeGeometry supplies coordinates in metres; doors and window paintings
    // need their entire image mapped exactly once within the arched opening.
    const position=panelGeometry.getAttribute('position');
    const uv=panelGeometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/w+.5,position.getY(i)/h);
    uv.needsUpdate=true;
    const panel=new T.Mesh(panelGeometry,m[entrance?'door':glass]);panel.position.z=.045;local.add(panel);
    if(entrance)panel.userData.landmarkPaintedDoor=true;
    else if(['glass','glassLight'].includes(glass))panel.userData.landmarkPaintedGlass=true;
    if(mullions){
      if(!entrance){
        // Two square-section wooden mullions replace the rounded cylinders:
        // 12 instead of 24 triangles per bar, while keeping the arch intact.
        const vertical=new T.Mesh(new T.BoxGeometry(.068,h-.06,.064),m[frame]);
        vertical.position.set(0,h*.5,.064);vertical.userData.landmarkWindowMullion=true;local.add(vertical);
        const horizontal=new T.Mesh(new T.BoxGeometry(w-.07,.068,.065),m[frame]);
        horizontal.position.set(0,h*.46,.069);horizontal.userData.landmarkWindowMullion=true;local.add(horizontal);
      }
    }
    if(decoration){
      const outline=new T.Mesh(archSurround(w,h,hi?22:12),m[frame]);
      outline.userData.landmarkOpeningSurround=true;
      local.add(outline);
      const sill=new T.Mesh(new T.BoxGeometry(w+.4,.16,.21),entrance?m[frame]:m.sill);sill.position.set(0,-.065,.09);local.add(sill);
    }else{
      // A reduced but still connected profile remains at medium/low LOD.
      const outline=new T.Mesh(archSurround(w,h,lo?6:12),m[frame]);
      outline.userData.landmarkOpeningSurround=true;
      local.add(outline);
      if(!entrance){
        const sill=new T.Mesh(new T.BoxGeometry(w+.2,.13,.17),m.sill);sill.position.set(0,-.04,.09);local.add(sill);
      }
    }
    if(entrance){
      for(const sign of [-1,1]){
        const handle=new T.Mesh(new T.SphereGeometry(.055,8,6),m.gold);
        handle.position.set(sign*w*.055,h*.43,.07);handle.userData.landmarkDoorHandle=true;local.add(handle);
      }
      local.userData.entrance=true;
    }
    return local;
  };
  const column=(x,z,baseY,height,rad=.35,{mat='ivory',fluted=hi}={})=>{
    const foot=cyl(x,baseY+.18,z,rad*1.38,rad*1.51,.36,'stone',lo?8:12);
    foot.userData.landmarkColumnFoot=true;
    cyl(x,baseY+height*.5,z,rad*.88,rad, height-.5,mat,fluted?16:8);
    cyl(x,baseY+height-.18,z,rad*1.28,rad*1.12,.36,'stone',lo?8:12);
    if(fluted){for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      beam([x+Math.cos(a)*rad*.92,baseY+.55,z+Math.sin(a)*rad*.92],[x+Math.cos(a)*rad*.8,baseY+height-.53,z+Math.sin(a)*rad*.8],.025,'pale',5);
    }}
  };
  const pediment=(x,y,z,w,rise,mat='ivory')=>{
    // A closed stone tympanum. The previous one-sided triangle disappeared
    // from oblique angles, leaving only two floating border beams.
    const profile=new T.Shape();profile.moveTo(-w/2,0);profile.lineTo(w/2,0);
    profile.lineTo(0,rise);profile.closePath();
    const depth=.26;
    const geom=new T.ExtrudeGeometry(profile,{depth,steps:1,bevelEnabled:false,curveSegments:1});
    const face=attach(geom,mat,[x,y,z]);face.userData.landmarkSolidPediment=true;
    if(!lo){
      beam([x-w/2,y,z+depth+.07],[x,y+rise,z+depth+.07],.11,'stone');
      beam([x,y+rise,z+depth+.07],[x+w/2,y,z+depth+.07],.11,'stone');
    }
    return face;
  };
  const stairs=(platformFront,width=7,steps=4,rise=.16)=>{
    // Contiguous stone risers. The previous 0.8 m slabs overlapped by 0.33 m,
    // creating coplanar painted treads that flickered during orbiting.
    const tread=.47;
    // Export the actual end of the staircase for the shared pedestrian network.
    root.userData.pathAccess={x:0,z:platformFront+steps*tread+.32,forward:[0,1]};
    for(let i=0;i<steps;i++){
      const height=(i+1)*rise;
      const frontOffset=(steps-i-.5)*tread;
      const mesh=box(0,height/2,platformFront+frontOffset,width+frontOffset*.09,height,tread,'stoneStep');
      mesh.userData.landmarkStairStep=i;
    }
  };
  const chimney=(x,baseY,z,height=2.6)=>{
    // Stone chimney goes through the roof slope; smoke starts at its cap.
    box(x,baseY+height*.5,z,.72,height,.72,'stoneDark');
    const cap=box(x,baseY+height+.025,z,.88,.18,.88,'stone');
    cap.userData.landmarkSmokeEmitter={x,y:baseY+height+.16,z};
  };
  const clock=(x,y,z,r=1.22)=>{
    // The inset stone drum physically connects the clock face and bezel to
    // the masonry, including on the high tower where the wall is set back.
    const backing=attach(new T.CylinderGeometry(r*1.035,r*1.035,.24,lo?16:36),
      'stone',[x,y,z+.06],[Math.PI/2,0,0]);
    backing.userData.landmarkClockBacking=true;
    const face=attach(new T.CylinderGeometry(r,r,.12,lo?16:36),'pale',[x,y,z],[Math.PI/2,0,0]);
    face.userData.clock=true;face.userData.landmarkClockFace=true;
    // One concentric ring on the front replaces a rear cylinder whose
    // lower silhouette looked like a detached arc under the clock.
    face.position.z=z+.17;
    const bezel=attach(new T.TorusGeometry(r*1.025,.083,8,lo?24:48),'gold',[x,y-.055,z+.295]);
    bezel.userData.landmarkClockBezel=true;
    if(!lo){
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        const p=[x+Math.sin(a)*r*.74,y+Math.cos(a)*r*.74,z+.255];
        const tick=box(...p,.065,i%3===0?.25:.13,.055,'iron');tick.rotation.z=-a;
      }
      // Both hands and the centre pin intersect the painted dial instead of
      // hovering in front of it as independent, disconnected objects.
      beam([x,y,z+.25],[x-.26*r,y+.45*r,z+.25],.045,'iron');
      beam([x,y,z+.26],[x+.58*r,y+.12*r,z+.26],.034,'iron');
      ball(x,y,z+.27,.08,'gold',8);
    }
  };
  const sideWindows=(x,zStart,spacing,count,y,w,h,options)=>{
    for(const sign of [-1,1])for(let i=0;i<count;i++)arch(sign*x,y,zStart+i*spacing,w,h,{...options,side:sign});
  };
  const facadeArch=(wallZ,x,y,z,w,h,options)=>{
    const opening=arch(x,y,z,w,h,options);
    opening.userData.landmarkWallFaceZ=wallZ;
    return opening;
  };

  return {attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch};
}
