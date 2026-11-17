// KEYNLOCK landmarks: reusable world-space meshes, front entrances face +Z.
// All dimensions are in metres; LODs retain their major architectural masses.
import {acquireLandmarkTextures} from './landmark-textures.js';

// Physical size of one copy of the 20-column / 14-row painted roof atlas.
// UVs are derived from the pitch dimensions, not normalized to each roof.
const ROOF_METRES_U = 8;
const ROOF_METRES_V = 8;
const STONE_METRES_PER_TILE = 4.6;

export const LANDMARK_CATALOG = Object.freeze([
  {id:'church',name:'Церковь главной площади',short:'Церковь',district:'Старый город',role:'Духовный центр',subtitle:'Каменный неф · колокольня · витражи',description:'Высокая колокольня, старый каменный неф с контрфорсами, цветные витражи и ступени у парадного входа.',footprint:'11 × 24 м'},
  {id:'theater',name:'Королевский театр',short:'Театр',district:'Богемный квартал',role:'Культура',subtitle:'Портик · фронтон · сцена',description:'Небольшой городской театр с глубокой сценической коробкой, классическим портиком и красной черепичной кровлей.',footprint:'21 × 25 м'},
  {id:'museum',name:'Городской музей искусств',short:'Музей',district:'Квартал искусств',role:'Культура и коллекции',subtitle:'Колоннада · медный купол · скульптуры',description:'Светлое каменное здание с шестиколонным портиком, медным куполом и парадной лестницей.',footprint:'25 × 19 м'},
  {id:'townhall',name:'Ратуша Кийенлока',short:'Ратуша',district:'Старый город',role:'Городская власть',subtitle:'Часовая башня · балкон · аркады',description:'Городская ратуша с большими часами, торговой аркадой первого этажа и галереей под башней.',footprint:'19 × 15 м'},
  {id:'palace',name:'Дворец Кийенлока',short:'Дворец',district:'Дворцовый холм',role:'Резиденция',subtitle:'Крылья · павильоны · парадный двор',description:'Симметричная резиденция с высоким центральным ризалитом, двумя крыльями и четырьмя угловыми башенками.',footprint:'44 × 24 м'},
  {id:'tower',name:'Высокая башня Кийенлока',short:'Высокая башня',district:'Верхний город',role:'Городской ориентир',subtitle:'Каменная башня · часы · медный шпиль',description:'Самая высокая постройка над крышами Кийенлока: многоярусная каменная башня с четырьмя циферблатами, открытой смотровой галереей и узким медным шпилем. Видна из порта и с дальних мостов.',footprint:'12 × 12 м'},
]);

const DETAILS=['high','medium','low'];
export const LANDMARK_CHIMNEY_DEFAULTS=Object.freeze({
  church:false,theater:false,museum:false,townhall:false,palace:true,tower:false,
});
export function landmarkTriangleCount(root) {
  let triangles=0,meshes=0;
  root.traverse(object=>{
    if(!object.isMesh)return;
    meshes++;
    const geometry=object.geometry;
    triangles+=(geometry.index?.count??geometry.getAttribute('position')?.count??0)/3;
  });
  return {triangles:Math.round(triangles),meshes};
}

export function createLandmarkModel(T,id,{detail='high',chimneys=LANDMARK_CHIMNEY_DEFAULTS[id]}={}) {
  if(!DETAILS.includes(detail))throw new Error(`Неизвестный LOD: ${detail}`);
  if(!LANDMARK_CATALOG.some(item=>item.id===id))throw new Error(`Неизвестный памятник: ${id}`);
  const hi=detail==='high',lo=detail==='low',mid=!hi&&!lo;
  const root=new T.Group();root.name=`KEYNLOCK · ${id} · ${detail}`;
  const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.96,metalness:0,...extra});
  const paintedGlass=(color)=>new T.MeshPhysicalMaterial({
    color,roughness:.28,metalness:.1,clearcoat:.86,clearcoatRoughness:.11,
    side:T.DoubleSide,
  });
  const m={
    ivory:material('#eee0c2'),cream:material('#d6c3a4'),stone:material('#c0ac8b'),stoneDark:material('#8f816a'),
    plaster:material('#e2d2b4'),pale:material('#f5e9cf'),brick:material('#b98065'),
    roof:material('#a64d3c',{side:T.DoubleSide}),roofDeep:material('#653c3c',{side:T.DoubleSide}),
    roofTrim:material('#754739'),slateTrim:material('#566b73'),
    slate:material('#506873',{side:T.DoubleSide}),slateLight:material('#78909a',{side:T.DoubleSide}),
    copper:material('#689589',{metalness:.12,side:T.DoubleSide}),copperLight:material('#9bb9a2'),
    glass:paintedGlass('#d0e0df'),glassLight:paintedGlass('#f0f2e9'),
    gold:material('#c6a466',{metalness:.28}),
    wood:material('#593e30'),woodLight:material('#96765c'),iron:material('#39474b',{metalness:.24}),
    shadow:material('#493e35'),grass:material('#8da17c'),stoneStep:material('#d5c6a7'),
    door:material('#ffffff',{side:T.DoubleSide}),sill:material('#d9c09c'),
  };
  const textureLease=acquireLandmarkTextures(T);
  const paintedSurfaces={
    // One subdued gouache ashlar painting across the buildings' masonry.
    // The smooth clock dial stays on plaster, glass and sills keep theirs.
    ivory:'stone',cream:'stone',plaster:'stone',pale:'plaster',brick:'stone',
    stone:'stone',stoneDark:'stone',stoneStep:'stone',sill:'sill',
    roof:'roof',roofDeep:'roof',slate:'roof',slateLight:'roof',
    copper:'copper',copperLight:'copper',
    door:'door',glass:'glass',glassLight:'glass',
  };
  for(const [key,kind] of Object.entries(paintedSurfaces)){
    const mat=m[key];mat.map=textureLease.maps[kind]??null;
    // Verdigris is already colored; tile and stone tones come from pigments.
    if(kind==='copper')mat.color.set('#ffffff');
    mat.userData.landmarkTexture=kind;
    mat.needsUpdate=true;
  }
  for(const key of ['stone','stoneDark','stoneStep'])m[key].userData.landmarkSurface='architecturalStone';
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

  const church=()=>{
    box(0,.27,0,14.7,.55,23.5,'stone');
    box(0,5.8,-1.1,9.8,10.8,18,'ivory');
    box(0,1.15,-1.1,10.1,1.55,18.3,'stone');
    wedge(0,11.15,-1.1,10.0,18,4.1,'slate');
    if(chimneys)chimney(-3.0,11.45,-4.5,3.35);
    for(const s of [-1,1]){
      box(s*6.35,3.7,-1.2,3.1,6.9,15.4,'cream');
      box(s*6.35,.7,-1.2,3.4,.9,15.5,'stone');
      // Rooflets over the low side aisles sit below the main clerestory.
      wedge(s*6.35,7.2,-1.2,3.1,15.4,1.85,'slate');
      const bayCount=lo?3:hi?5:4,spacing=11.7/(bayCount-1);
      for(let i=0;i<bayCount;i++){
        const z=-6.5+i*spacing;
        const window=arch(s*7.92,2.6,z,1.12,3.2,{glass:'glassLight',side:s});
        window.userData.landmarkChurchAisleWindow=true;
      }
      if(!lo)for(let i=0;i<bayCount-1;i++){
        // The buttress bears against the aisle wall in the middle of a pier,
        // between two windows, rather than hovering beside one sash.
        const z=-6.5+(i+.5)*spacing;
        const pier=box(s*8.13,3.05,z,.65,5.7,.72,'cream');
        pier.userData.landmarkChurchButtress=true;
        const foot=box(s*8.2,.64,z,.88,1.12,1.02,'cream');
        foot.userData.landmarkChurchButtressFoot=true;
        box(s*8.13,6.0,z,.78,.2,.84,'ivory');
      }
    }
    if(!lo)sideWindows(4.96,-7.7,4.3,4,8.7,1.1,2.15,{glass:'glassLight',frame:'cream'});
    // Hexagonal, lower polygonal choir: apse terminates the central nave.
    const apse=cyl(0,5.05,-10.4,3.7,3.7,8.7,'ivory',hi?12:lo?6:8);apse.scale.z=.76;
    const apseRoof=cone(0,11.1,-10.4,4.15,3.8,'slate',hi?12:lo?6:8);apseRoof.scale.z=.8;
    for(const i of [-1,0,1])arch(i*2,4.5,-13.15,1.08,3.3,{glass:'glassLight'});
    // The tower protrudes from the western (front) facade, with a valid entry.
    box(0,9.2,9.25,5.1,17.7,5.2,'ivory');
    box(0,.6,9.25,5.55,1.1,5.7,'stoneDark');
    // Cornices occupy the stone piers BETWEEN the door, window and belfry.
    // The former 4.4/10.5 m belts visibly sliced through both arches.
    for(const y of [6.1,13.05,17.1]){
      const band=box(0,y,9.25,5.5,.42,5.65,'ivory');
      band.userData.landmarkChurchTowerBand=true;
    }
    const entry=arch(0,.95,11.98,2.35,4.35,{entrance:true,frame:'ivory'});
    entry.userData.landmarkChurchTowerOpening=true;
    const middleWindow=arch(0,9.0,11.89,1.9,3.0,{glass:'glassLight',frame:'ivory'});
    middleWindow.userData.landmarkChurchTowerOpening=true;
    // Belfry opening: dark recessed arch on each visible face.
    box(0,20.15,9.25,4.35,5.4,4.4,'ivory');
    arch(0,18.65,11.53,1.45,3.5,{glass:'shadow',mullions:false});
    if(!lo){
      arch(-2.19,18.65,9.25,1.4,3.4,{glass:'shadow',side:-1,mullions:false});
      arch(2.19,18.65,9.25,1.4,3.4,{glass:'shadow',side:1,mullions:false});
      if(hi){cyl(0,19.55,11.63,.42,.42,.58,'gold',12);}
    }
    box(0,23.02,9.25,5.7,.66,5.6,'ivory');
    cone(0,27.4,9.25,3.55,8.4,'slate',4);
    cyl(0,31.72,9.25,.12,.12,1.4,'gold',8);
    beam([-1.05,32.05,9.25],[1.05,32.05,9.25],.12,'gold');
    if(hi)for(const x of [-2.5,2.5]){
      box(x,11.65,11.35,.3,1.3,.3,'ivory');
      ball(x,12.45,11.35,.23,'gold');
    }
    stairs(12.0,5.5,4,.14);
  };

  const theater=()=>{
    // One full-footprint plinth under the auditorium, portico AND deep stage.
    const foundation=box(0,.26,-2,21.2,.52,24.7,'stone');
    foundation.userData.landmarkTheaterFoundation=true;
    box(0,5.25,-1.1,19.2,9.6,14,'brick');
    // Rear stage begins at the back of the auditorium. Its taller walls no
    // longer project through the lower red-tile auditorium roof.
    box(0,5.2,-11.2,15.2,9.8,6.2,'plaster'); // stage fly-house
    box(0,11.2,-11.2,15.3,2.4,6.3,'brick');
    wedge(0,10.0,-1.1,19.1,14.1,3.9,'roof',.45,'brick');
    // The stage roof now ends behind the auditorium eave; pitched meshes
    // previously intersected and made an uneven notch at the junction.
    wedge(0,12.6,-11.85,15.2,5.95,2.6,'roofDeep',.45,'brick');
    if(chimneys)chimney(4.15,12.7,-11.1,3.45);
    const entranceWallZ=6.55;
    box(0,5.2,5.2,16.3,8.9,2.7,'ivory');
    box(0,9.8,8.6,18,.72,3.6,'stone');
    // A solid stone podium replaces the previously suspended thin shelf.
    // Its bottom joins the plaza foundation and its top carries every column.
    const theaterPodium=box(0,.88,7.85,21.2,.72,4.6,'stone');
    theaterPodium.userData.landmarkColumnSupport=true;
    const count=lo?4:hi?6:5;
    for(let i=0;i<count;i++){
      const x=(-.5+i/(count-1))*13.3;
      column(x,9.05,1.24,8.25,.37);
    }
    pediment(0,10.15,10.4,18,3.1,'ivory');
    if(hi){
      box(0,11.03,10.77,4.9,.33,.22,'gold');
      // Decorative lyre motif in the tympanum.
      beam([-1.2,10.72,10.8],[0,12.06,10.8],.1,'gold');
      beam([1.2,10.72,10.8],[0,12.06,10.8],.1,'gold');
      ball(0,11.3,10.85,.25,'gold');
    }
    // Recess the entrance wall and put the half-sized doors in the bays
    // between columns instead of directly behind their shafts.
    for(const x of [-5.32,0,5.32])facadeArch(entranceWallZ,x,1.24,entranceWallZ+.07,1.125,2.125,{entrance:true,frame:'stone'});
    const sideN=lo?2:4;
    for(const sign of [-1,1])for(let i=0;i<sideN;i++)arch(sign*9.7,5.1,-5.6+i*(10/(sideN-1)),1.25,2.4,{glass:'glassLight',side:sign});
    if(!lo){
      for(const x of [-7.7,7.7]){
        // Pilasters run from the podium all the way into the entablature.
        const pilaster=box(x,5.34,8.31,.5,8.2,.36,'stone');
        pilaster.userData.landmarkTheaterPilaster=true;
        if(hi){ball(x,9.37,8.45,.38,'gold');}
      }
    }
    stairs(10.15,17,6,.207);
  };

  const museum=()=>{
    const museumFoundation=box(0,.28,-.3,24.9,.56,18.9,'stone');
    museumFoundation.userData.landmarkColumnSupport=true;
    box(0,5.15,-1.6,22.5,9.3,14.6,'plaster');
    box(0,9.95,-1.6,23,.56,15.2,'ivory');
    hipRoof(0,10.2,-1.6,23,15,2.5,'slate');
    if(chimneys)chimney(-7.5,10.45,-4.6,3.55);
    // Round rotunda emerges from the shallow hipped gallery roof.
    cyl(0,12.1,-2.4,4.1,4.1,3.55,'stone',hi?28:lo?12:18);
    for(let i=0;i<(lo?6:hi?12:8);i++){
      const a=i*2*Math.PI/(lo?6:hi?12:8);
      const x=Math.sin(a)*3.9,z=-2.4+Math.cos(a)*3.9;
      if(!lo)box(x,12.3,z,.21,2.55,.23,'ivory');
    }
    const dome=attach(new T.SphereGeometry(4.15,lo?12:hi?32:20,lo?6:hi?16:10,0,Math.PI*2,0,Math.PI/2),'copper',[0,13.8,-2.4]);
    dome.scale.y=.85;
    cyl(0,17.2,-2.4,.75,.9,.58,'gold',16);
    ball(0,17.7,-2.4,.35,'gold',12);
    box(0,4.85,6.5,17.2,8.7,3.1,'ivory');
    box(0,9.42,8.7,18.4,.62,4.5,'stone');
    const count=lo?4:6;
    for(let i=0;i<count;i++){
      const x=-7.2+i*14.4/(count-1);
      column(x,8.7,.56,8.56,.43);
    }
    pediment(0,9.71,10.95,18.2,3.1,'ivory');
    // All openings lie against the actual 8.05 m front wall.
    facadeArch(8.05,0,1.0,8.13,1.425,2.3,{entrance:true,frame:'stone'});
    for(const x of [-4.3,4.3])facadeArch(8.05,x,2.75,8.13,1.9,4.1,{glass:'glassLight',frame:'stone'});
    for(const sign of [-1,1])for(let i=0;i<(lo?2:4);i++)arch(sign*11.32,3.9,-6.8+i*3.6,1.18,2.85,{glass:'glassLight',side:sign});
    if(!lo){
      for(const x of [-9.4,9.4]){
        box(x,1.52,8.55,1.35,1.95,1.35,'stone');
        const sculpture=ball(x,2.97,8.55,.7,'ivory',hi?18:10);sculpture.scale.y=1.25;
        if(hi)cyl(x,3.44,8.55,.26,.25,.6,'ivory',8);
      }
    }
    stairs(9.15,18,4,.14);
  };

  const townhall=()=>{
    box(0,.28,-.6,19.6,.56,14.8,'stone');
    box(0,6.3,-1,18.4,11.8,13,'cream');
    // Low plinth stops below the openings; the old 2.15 m band hid
    // the lower portions of every ground-floor arch and the main door.
    box(0,.51,-1,18.9,.88,13.4,'stone');
    wedge(0,12.15,-1,18.8,13.6,4.0,'slate');
    if(chimneys)chimney(-5.65,11.95,-4.2,4.05);
    // Public arcaded ground floor, dark inset archways.
    const count=lo?3:5;
    for(let i=0;i<count;i++){
      const x=-7.0+i*(14/(count-1));
      arch(x,1.1,5.65,1.8,3.3,{glass:i===(count-1)/2?'wood':'shadow',frame:'ivory',entrance:i===(count-1)/2});
      if(!lo)arch(x,7.0,5.69,1.35,2.3,{glass:'glassLight',frame:'ivory'});
    }
    for(const sign of [-1,1])for(let i=0;i<(lo?2:3);i++)arch(sign*9.26,6,-4.5+i*3.65,1.2,2.5,{glass:'glassLight',side:sign});
    box(0,4.67,6.3,6.1,.32,2.1,'stone'); // balcony
    if(!lo){
      for(let i=0;i<9;i++)box(-2.6+i*.65,5.30,7.2,.13,1.05,.13,'iron');
      box(0,5.82,7.2,6,.18,.2,'iron');
    }
    // Tall municipal tower, clock set into the front wall above the roofline.
    const towerLift=3.5;
    box(0,16.1+towerLift,-1.1,5.7,11.4,5.6,'ivory');
    for(const y of [12.0,17.9,21.9])box(0,y+towerLift,-1.1,6.05,.45,6.0,'stone');
    clock(0,18.9+towerLift,1.64,1.45);
    arch(0,14.0+towerLift,1.84,1.6,2.5,{glass:'shadow',frame:'stone'});
    if(!lo){
      for(const sign of [-1,1])arch(sign*2.9,14+towerLift,-1.15,1.12,2.7,{glass:'shadow',side:sign});
      for(const x of [-2.7,2.7])cyl(x,22.7+towerLift,1.2,.25,.25,1.2,'gold',8);
    }
    box(0,22.43+towerLift,-1.1,6.3,.65,6.2,'stone');
    cone(0,25.85+towerLift,-1.1,4.2,6.2,'copper',4);
    cyl(0,29.3+towerLift,-1.1,.12,.12,1.4,'gold',8);
    ball(0,30.15+towerLift,-1.1,.4,'gold',10);
    stairs(6.8,8.6,4,.26);
  };

  const palace=()=>{
    // The four corner towers extend to x=+/-21.4 m. Support their full
    // footprint with masonry, including an outer margin at both ends.
    const palaceFoundation=box(0,.35,-1,44,.7,24.3,'stone');
    palaceFoundation.userData.landmarkPalaceFoundation=true;
    const wing=(x,w)=>{
      box(x,6.1,-2.1,w,11,16,'plaster');
      box(x,1.2,-2.1,w+.4,2.0,16.4,'stone');
      box(x,11.65,-2.1,w+.3,.48,16.3,'ivory');
      // Eaves should overlap the cornice rather than reveal sky between them.
      const roof=hipRoof(x,11.86,-2.1,w+.1,16.1,3.8,'slate');
      roof.userData.landmarkPalaceRoof=true;
      if(chimneys)chimney(x,12.8,-4.1,3.7);
      const n=lo?3:hi?6:4;
      for(let i=0;i<n;i++){
        const xx=x+(i/(n-1)-.5)*(w-2.3);
        for(const yy of [3.2,7.5])arch(xx,yy,6.02,lo?1.0:1.28,lo?2.15:2.75,{glass:'glassLight',frame:'ivory'});
      }
    };
    wing(-12.7,13.1);wing(12.7,13.1);
    box(0,7.1,-2.1,13.8,13.2,16.2,'ivory');
    box(0,13.86,-2.1,14.3,.45,16.5,'stone');
    const centralRoof=hipRoof(0,14.06,-2.1,14.1,16.2,4.4,'slate');
    centralRoof.userData.landmarkPalaceRoof=true;
    // Colonnaded projecting central risalit.
    const palacePodium=box(0,2.15,7.25,11.9,3.1,4.0,'stone');
    palacePodium.userData.landmarkColumnSupport=true;
    box(0,10.88,8.3,12.7,.65,5.4,'ivory');
    for(const x of [-5.2,-3.1,-1.05,1.05,3.1,5.2])column(x,8.55,3.7,7.0,.35);
    // The sculpted triangle and its sun belong near the front lip of the
    // portico entablature (front z=11), not halfway across its flat roof.
    const pedimentFrontZ=10.78;
    const palacePediment=pediment(0,11.22,pedimentFrontZ,13,3.0,'ivory');
    palacePediment.userData.landmarkPalacePediment=true;
    if(hi){
      const sun=ball(0,12.0,pedimentFrontZ+.12,.45,'gold',16);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        beam([Math.cos(a)*.68,12+Math.sin(a)*.52,pedimentFrontZ+.17],[Math.cos(a)*1.06,12+Math.sin(a)*.8,pedimentFrontZ+.17],.065,'gold');
      }
      sun.scale.z=.6;
    }
    // Portico openings are fixed to the central facade (front at z=6.0).
    // The old z=8.4 positions placed them in the empty air between the wall
    // and the freestanding columns.
    facadeArch(6.0,0,3.72,6.12,2.6,4.5,{entrance:true,frame:'ivory'});
    for(const x of [-4.5,4.5])facadeArch(6.0,x,4.6,6.12,1.6,3.7,{glass:'glassLight',frame:'stone'});
    for(const x of [-3.3,0,3.3])arch(x,10.9,6.14,1.38,2.4,{glass:'glassLight',frame:'stone'});
    // Four corner pavilions anchor the silhouette; lower than church tower.
    for(const x of [-19.3,19.3])for(const z of [-9.3,5.6]){
      const towerBody=box(x,8.25,z,4.2,15.1,4.15,'cream');
      towerBody.userData.landmarkPalaceCornerTower=true;
      box(x,.91,z,4.5,.42,4.45,'stone');
      for(const yy of [4.0,9.1])if(!lo)arch(x,yy,z+2.13,1.25,2.65,{glass:'glassLight',frame:'ivory'});
      box(x,16.02,z,4.6,.5,4.7,'stone');
      // Spires begin above the highest adjacent hip-roof ridge (15.8 m).
      // Their bases previously cut through the painted roof faces.
      cone(x,18.88,z,3.35,5.3,'slate',4);
      if(!lo)ball(x,21.70,z,.26,'gold',10);
    }
    stairs(9.25,11.6,14,3.7/14);
    if(!lo){
      // Front ornamental balustrades and flower planters.
      for(const x of [-15.2,-13.9,-12.6,-11.3,11.3,12.6,13.9,15.2]){
        box(x,6.75,6.0,.21,1.05,.2,'ivory');
        ball(x,7.42,6.0,.17,'stone',8);
      }
      for(const x of [-8.2,8.2]){
        box(x,.95,10.5,1.5,1.25,1.5,'stone');
        if(hi)ball(x,1.75,10.5,.5,'grass');
      }
    }
  };

  const tower=()=>{
    // Vertical city landmark: 59 metres to the finial, deliberately taller
    // than the town hall, palace and church. All LODs preserve its silhouette.
    box(0,.42,0,13.3,.84,13.3,'stone');
    for(const [y,w,h] of [[6.3,10.8,11.5],[18.7,9.4,13.4],[31.1,8.1,11.4]]){
      box(0,y,0,w,h,w,'cream');
      box(0,y+h/2+.13,0,w+.8,.42,w+.8,'stone');
    }
    box(0,1.45,0,11.8,1.9,11.8,'stone');
    facadeArch(5.44,0,.85,5.5,2.15,4.3,{entrance:true,frame:'ivory'});
    // Recessed vertical lancets and sharp, progressively narrower stages.
    for(const y of [8.0,20.8,32.5]){
      const half=y<15?5.45:y<28?4.75:4.12;
      arch(0,y,half+.02,1.2,3.25,{glass:'shadow',frame:'stone',mullions:hi});
      if(!lo){
        for(const x of [-2.4,2.4])arch(x,y,half+.02,.74,2.65,{glass:'glass',frame:'ivory',mullions:hi});
        for(const side of [-1,1])arch(side*half,y,0,1.05,3.0,{glass:'shadow',frame:'stone',side,mullions:hi});
      }
    }
    // Four heavy piers visibly anchor the slender shaft in the plinth.
    for(const x of [-5.1,5.1])for(const z of [-5.1,5.1]){
      box(x,6.5,z,.85,12.2,.85,'stone');
      if(hi){box(x,13.0,z,1.12,.6,1.12,'ivory');box(x,1.25,z,1.08,2.2,1.08,'stoneDark');}
    }
    // Clock belfry above the masonry stages. A front clock is legible at all
    // distances; other faces and open arches enrich the close-range model.
    box(0,40.1,0,8.65,6.7,8.65,'ivory');
    for(const y of [36.55,43.68])box(0,y,0,9.2,.56,9.2,'stone');
    // Supporting masonry joins the upper cornice to the lookout platform.
    box(0,44.19,0,9.0,.6,9.0,'ivory');
    clock(0,40.2,4.26,1.55);
    if(!lo){
      for(const side of [-1,1]){
        const face=new T.Group();face.rotation.y=side*Math.PI/2;face.position.x=side*4.30;root.add(face);
        const dial=new T.Mesh(new T.CylinderGeometry(1.48,1.48,.16,hi?36:20),m.pale);
        dial.rotation.x=Math.PI/2;dial.rotation.z=Math.PI/2;dial.position.y=40.2;face.add(dial);
      }
      for(const x of [-2.75,2.75])arch(x,36.95,4.39,.85,1.9,{glass:'shadow',frame:'stone'});
      for(let i=0;i<12;i++){
        const x=-4.1+i*.74;
        box(x,44.65,4.2,.16,1.2,.19,'iron');
      }
      box(0,45.2,4.2,9.0,.18,.2,'iron');
    }
    // Open lookout with four corner pinnacles and a very tall slate-and-
    // copper needle. Distinctive even in the low-poly silhouette.
    box(0,45.3,0,9.2,1.8,9.2,'stone');
    for(const x of [-3.8,3.8])for(const z of [-3.8,3.8]){
      cyl(x,47.15,z,.44,.48,2.4,'stone',8);
      cone(x,49.35,z,.86,2.1,'slate',8);
    }
    // The central roof stays inside the four corner pinnacles throughout its
    // height; previously its wide cone cut through their stone and slate.
    cone(0,51.83,0,3.35,11.4,'copper',8);
    cyl(0,58.20,0,.18,.18,1.4,'gold',8);
    ball(0,59.20,0,.36,'gold',hi?14:8);
    if(hi){
      for(const x of [-3.8,3.8])for(const z of [-3.8,3.8]){
        beam([x,14,z],[x,29,z],.12,'stoneDark',6);
      }
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        ball(Math.cos(a)*4.25,44.33,Math.sin(a)*4.25,.32,'ivory',8);
      }
    }
    stairs(6.2,5.1,4,.14);
  };

  ({church,theater,museum,townhall,palace,tower}[id])();
  const stats=landmarkTriangleCount(root);
  const setWindowAppearance=({gloss=72,reflection=46,night=false,glow=64,envMap=null}={})=>{
    const g=T.MathUtils.clamp(gloss/100,0,1),r=T.MathUtils.clamp(reflection/100,0,1);
    for(const mat of [m.glass,m.glassLight]){
      if(mat.envMap!==envMap){mat.envMap=envMap;mat.needsUpdate=true;}
      mat.roughness=.55-g*.5;
      mat.metalness=.025+r*.25;
      mat.clearcoat=.2+g*.8;
      mat.clearcoatRoughness=.3-g*.26;
      mat.envMapIntensity=.18+r*1.75;
      mat.emissive.set(night?'#e49753':'#000000');
      mat.emissiveIntensity=night?(.35+T.MathUtils.clamp(glow/100,0,1)*1.16):0;
    }
  };
  setWindowAppearance();
  // Model-level resources are owned by this instance only; never dispose
  // imported city or house materials when changing the inspector's model.
  const dispose=()=>{
    const geos=new Set();root.traverse(o=>{if(o.isMesh)geos.add(o.geometry);});
    geos.forEach(g=>g.dispose());textureLease.release();Object.values(m).forEach(mat=>mat.dispose());
  };
  return {group:root,dispose,stats,detail,id,setWindowAppearance,textureMaps:textureLease.maps,
    entranceCount:(()=>{let count=0;root.traverse(o=>{if(o.userData.entrance)count++;});return count;})()};
}
