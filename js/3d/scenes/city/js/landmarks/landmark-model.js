// KEYNLOCK landmarks: reusable world-space meshes, front entrances face +Z.
// All dimensions are in metres; LODs retain their major architectural masses.
export const LANDMARK_CATALOG = Object.freeze([
  {id:'church',name:'Церковь главной площади',short:'Церковь',district:'Старый город',role:'Духовный центр',subtitle:'Каменный неф · колокольня · витражи',description:'Высокая колокольня, старый каменный неф с контрфорсами, цветные витражи и ступени у парадного входа.',footprint:'11 × 24 м'},
  {id:'theater',name:'Королевский театр',short:'Театр',district:'Богемный квартал',role:'Культура',subtitle:'Портик · фронтон · сцена',description:'Небольшой городской театр с глубокой сценической коробкой, классическим портиком и красной черепичной кровлей.',footprint:'21 × 20 м'},
  {id:'museum',name:'Городской музей искусств',short:'Музей',district:'Квартал искусств',role:'Культура и коллекции',subtitle:'Колоннада · медный купол · скульптуры',description:'Светлое каменное здание с шестиколонным портиком, медным куполом и парадной лестницей.',footprint:'25 × 19 м'},
  {id:'townhall',name:'Ратуша Кийенлока',short:'Ратуша',district:'Старый город',role:'Городская власть',subtitle:'Часовая башня · балкон · аркады',description:'Городская ратуша с большими часами, торговой аркадой первого этажа и галереей под башней.',footprint:'19 × 15 м'},
  {id:'palace',name:'Дворец Кийенлока',short:'Дворец',district:'Дворцовый холм',role:'Резиденция',subtitle:'Крылья · павильоны · парадный двор',description:'Симметричная резиденция с высоким центральным ризалитом, двумя крыльями и четырьмя угловыми башенками.',footprint:'41 × 24 м'},
]);

const DETAILS=['high','medium','low'];
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

export function createLandmarkModel(T,id,{detail='high'}={}) {
  if(!DETAILS.includes(detail))throw new Error(`Неизвестный LOD: ${detail}`);
  if(!LANDMARK_CATALOG.some(item=>item.id===id))throw new Error(`Неизвестный памятник: ${id}`);
  const hi=detail==='high',lo=detail==='low',mid=!hi&&!lo;
  const root=new T.Group();root.name=`KEYNLOCK · ${id} · ${detail}`;
  const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.96,metalness:0,...extra});
  const m={
    ivory:material('#eee0c2'),cream:material('#d6c3a4'),stone:material('#c0ac8b'),stoneDark:material('#8f816a'),
    plaster:material('#e2d2b4'),pale:material('#f5e9cf'),brick:material('#b98065'),
    roof:material('#a64d3c',{side:T.DoubleSide}),roofDeep:material('#653c3c',{side:T.DoubleSide}),
    slate:material('#506873',{side:T.DoubleSide}),slateLight:material('#78909a',{side:T.DoubleSide}),
    copper:material('#689589',{metalness:.12,side:T.DoubleSide}),copperLight:material('#9bb9a2'),
    glass:material('#456d7b',{metalness:.08,side:T.DoubleSide}),glassLight:material('#87a9ac',{side:T.DoubleSide}),
    stained:material('#aa805f',{side:T.DoubleSide}),gold:material('#c6a466',{metalness:.28}),
    wood:material('#593e30'),woodLight:material('#96765c'),iron:material('#39474b',{metalness:.24}),
    shadow:material('#493e35'),grass:material('#8da17c'),stoneStep:material('#d5c6a7'),
  };
  const attach=(geometry,mat,pos,rotation)=>{
    const mesh=new T.Mesh(geometry,typeof mat==='string'?m[mat]:mat);
    if(pos)mesh.position.set(...pos);
    if(rotation)mesh.rotation.set(...rotation);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const box=(x,y,z,w,h,d,mat)=>attach(new T.BoxGeometry(w,h,d),mat,[x,y,z]);
  const cyl=(x,y,z,rTop,rBottom,h,mat,sides=12)=>attach(new T.CylinderGeometry(rTop,rBottom,h,sides),mat,[x,y,z]);
  const cone=(x,y,z,r,h,mat,sides=8)=>attach(new T.ConeGeometry(r,h,sides),mat,[x,y,z]);
  const ball=(x,y,z,r,mat,segments=14)=>attach(new T.SphereGeometry(r,segments,Math.max(7,segments/2)),mat,[x,y,z]);
  const beam=(a,b,r,mat,sides=6)=>{
    const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
    const mesh=attach(new T.CylinderGeometry(r,r,delta.length(),sides),mat,start.clone().add(end).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;
  };
  const wedge=(x,y,z,w,d,rise,mat,eaves=.45)=>{
    // Two pitch faces plus the triangular end caps. y marks the wall plate.
    const left=x-w/2-eaves,right=x+w/2+eaves,front=z+d/2+eaves,back=z-d/2-eaves;
    const ridge=y+rise,edge=y-.15;
    const vertex=[left,edge,front,x,ridge,front,left,edge,back,x,ridge,back,
      x,ridge,front,right,edge,front,x,ridge,back,right,edge,back];
    const faces=[0,2,1,1,2,3,4,5,6,5,7,6];
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertex,3));geometry.setIndex(faces);geometry.computeVertexNormals();
    attach(geometry,mat); // roof panels
    for(const s of [-1,1]){
      const zz=s===1?front:back;
      const capG=new T.BufferGeometry();capG.setAttribute('position',new T.Float32BufferAttribute([left,edge,zz,right,edge,zz,x,ridge,zz],3));capG.computeVertexNormals();
      attach(capG,'stone');
    }
    if(!lo){
      for(const zz of [front,back]){
        beam([left,edge,zz],[x,ridge,zz],.075,'roofDeep');
        beam([x,ridge,zz],[right,edge,zz],.075,'roofDeep');
      }
      beam([x,ridge,front],[x,ridge,back],.09,'roofDeep');
    }
  };
  const hipRoof=(x,y,z,w,d,rise,mat)=>{
    // Mansard-like shallow hipped roof with a rectangular top ridge.
    const hw=w/2+.45,hd=d/2+.45,rz=Math.max(.05,hd-Math.min(hw,hd)*.65);
    const verts=[[-hw,y,z+hd],[hw,y,z+hd],[hw,y,z-hd],[-hw,y,z-hd],[0,y+rise,z+rz],[0,y+rise,z-rz]];
    const tris=[[0,1,4],[3,5,2],[0,4,5],[0,5,3],[1,2,5],[1,5,4]];
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(tris.flatMap(tri=>tri.flatMap(i=>[verts[i][0]+x,verts[i][1],verts[i][2]])),3));geometry.computeVertexNormals();attach(geometry,mat);
    if(!lo){box(x,y+.08,z+hd,w+.7,.18,.16,'roofDeep');box(x,y+.08,z-hd,w+.7,.18,.16,'roofDeep');}
  };
  const archShape=(w,h)=>{
    const sh=new T.Shape(),s=Math.min(w*.49,h*.31);
    sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-s);
    sh.absellipse(0,h-s,w/2,s,0,Math.PI,false,0);sh.lineTo(-w/2,0);
    return sh;
  };
  const arch=(x,y,z,w,h,{glass='glass',frame='ivory',entrance=false,side=0,mullions=hi,decoration=hi}={})=>{
    const local=new T.Group();local.position.set(x,y,z);if(side)local.rotation.y=side*Math.PI/2;root.add(local);
    const shape=archShape(w,h),panel=new T.Mesh(new T.ShapeGeometry(shape,lo?6:14),m[entrance?'wood':glass]);panel.position.z=.024;local.add(panel);
    const s=Math.min(w*.49,h*.31),shoulder=h-s;
    if(mullions){
      const lin=(a,b,r=.034,mat=frame)=>{
        const st=new T.Vector3(...a),en=new T.Vector3(...b),v=en.clone().sub(st);
        const mesh=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),6),m[mat]);mesh.position.copy(st.add(en).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());local.add(mesh);
      };
      if(!entrance){lin([0,.2,.055],[0,shoulder,.055]);lin([-w*.42,shoulder*.59,.055],[w*.42,shoulder*.59,.055]);}
      else {lin([-w*.06,.12,.06],[-w*.06,h*.75,.06],.025,'iron');lin([w*.06,.12,.06],[w*.06,h*.75,.06],.025,'iron');}
    }
    if(decoration){
      const verts=[[ -w/2-.09,-.02,.075 ],[ -w/2-.09,shoulder,.075 ]];
      for(let i=1;i<=12;i++){
        const a=Math.PI-i*Math.PI/12;verts.push([Math.cos(a)*w/2,shoulder+Math.sin(a)*s,.075]);
      }
      verts.push([w/2+.09,shoulder,.075],[w/2+.09,-.02,.075]);
      const path=new T.CatmullRomCurve3(verts.map(v=>new T.Vector3(...v)),false,'centripetal');
      const outline=new T.Mesh(new T.TubeGeometry(path,32,.085,5,false),m[frame]);local.add(outline);
      const sill=new T.Mesh(new T.BoxGeometry(w+.4,.16,.21),m[frame]);sill.position.set(0,-.065,.09);local.add(sill);
    }else if(!entrance){
      // Survives distance-based LOD as the recognizable stone outline.
      const sill=new T.Mesh(new T.BoxGeometry(w+.2,.13,.17),m[frame]);sill.position.set(0,-.04,.09);local.add(sill);
    }
    if(entrance){
      const handle=new T.Mesh(new T.SphereGeometry(.06,8,6),m.gold);handle.position.set(w*.25,h*.43,.14);local.add(handle);
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
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute([x-w/2,y,z,x+w/2,y,z,x,y+rise,z],3));geom.computeVertexNormals();attach(geom,mat);
    if(!lo){beam([x-w/2,y,z+.08],[x,y+rise,z+.08],.11,'stone');beam([x,y+rise,z+.08],[x+w/2,y,z+.08],.11,'stone');}
  };
  const stairs=(platformFront,width=7,steps=4,rise=.16)=>{
    // Each higher tread meets the one behind it and the front edge of the
    // real portico foundation. The lowest tread rests on ground level.
    for(let i=0;i<steps;i++){
      const height=(i+1)*rise;
      const frontOffset=(steps-i-1)*.47;
      box(0,height/2,platformFront+frontOffset,width+frontOffset*.09,height,.8,'stoneStep');
    }
  };
  const clock=(x,y,z,r=1.22)=>{
    const face=attach(new T.CylinderGeometry(r,r,.12,lo?16:36),'pale',[x,y,z],[Math.PI/2,0,0]);
    face.userData.clock=true;
    cyl(x,y,z+.09,r*1.08,r*1.08,.12,'gold',lo?16:36).rotation.x=Math.PI/2;
    // face must sit forward of the bezel.
    face.position.z=z+.17;
    if(!lo){
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        const p=[x+Math.sin(a)*r*.74,y+Math.cos(a)*r*.74,z+.255];
        const tick=box(...p,.065,i%3===0?.25:.13,.055,'iron');tick.rotation.z=-a;
      }
      beam([x,y,z+.31],[x-.26*r,y+.45*r,z+.31],.045,'iron');
      beam([x,y,z+.32],[x+.58*r,y+.12*r,z+.32],.034,'iron');
      ball(x,y,z+.34,.08,'gold',8);
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
    for(const s of [-1,1]){
      box(s*6.35,3.7,-1.2,3.1,6.9,15.4,'cream');
      box(s*6.35,.7,-1.2,3.4,.9,15.5,'stone');
      // Rooflets over the low side aisles sit below the main clerestory.
      wedge(s*6.35,7.2,-1.2,3.1,15.4,1.85,'slate');
      const bayCount=lo?3:hi?5:4;
      for(let i=0;i<bayCount;i++){
        const z=-6.5+i*(11.7/(bayCount-1));
        arch(s*7.92,2.6,z,1.12,3.2,{glass:i%2?'stained':'glassLight',side:s});
        if(!lo){box(s*8.02,3.1,z+1.2,.55,6.0,.67,'stone');}
      }
    }
    if(!lo)sideWindows(4.96,-7.7,4.3,4,8.7,1.1,2.15,{glass:'glassLight',frame:'cream'});
    // Hexagonal, lower polygonal choir: apse terminates the central nave.
    const apse=cyl(0,5.05,-10.4,3.7,3.7,8.7,'ivory',hi?12:lo?6:8);apse.scale.z=.76;
    const apseRoof=cone(0,11.1,-10.4,4.15,3.8,'slate',hi?12:lo?6:8);apseRoof.scale.z=.8;
    for(const i of [-1,0,1])arch(i*2,4.5,-13.15,1.08,3.3,{glass:'glassLight'});
    // The tower protrudes from the western (front) facade, with a valid entry.
    box(0,9.2,9.25,5.1,17.7,5.2,'stone');
    box(0,.6,9.25,5.55,1.1,5.7,'stoneDark');
    for(const y of [4.4,10.5,17.1])box(0,y,9.25,5.5,.42,5.65,'ivory');
    arch(0,.95,11.98,2.35,4.35,{entrance:true,frame:'ivory'});
    arch(0,9.0,11.89,1.9,3.0,{glass:'stained',frame:'ivory'});
    // Belfry opening: dark recessed arch on each visible face.
    box(0,20.15,9.25,4.35,5.4,4.4,'stone');
    arch(0,18.65,11.53,1.45,3.5,{glass:'shadow'});
    if(!lo){
      arch(-2.19,18.65,9.25,1.4,3.4,{glass:'shadow',side:-1});
      arch(2.19,18.65,9.25,1.4,3.4,{glass:'shadow',side:1});
      beam([-1.3,20.4,11.8],[1.3,20.4,11.8],.16,'stoneDark');
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
    box(0,.26,0,21.2,.52,20.7,'stone');
    box(0,5.25,-1.1,19.2,9.6,14,'brick');
    box(0,5.2,-8.4,15.2,9.8,5.8,'plaster'); // stage fly-house
    box(0,11.2,-8.4,15.3,2.4,5.9,'brick');
    wedge(0,10.0,-1.1,19.1,14.1,3.9,'roof');
    wedge(0,12.6,-8.4,15.2,5.9,2.6,'roofDeep');
    box(0,5.2,6.95,16.3,8.9,2.7,'ivory');
    box(0,9.8,8.6,18,.72,3.6,'stone');
    // A solid stone podium replaces the previously suspended thin shelf.
    // Its bottom joins the plaza foundation and its top carries every column.
    const theaterPodium=box(0,.88,8.55,17,.72,3.2,'stone');
    theaterPodium.userData.landmarkColumnSupport=true;
    const count=lo?4:hi?6:5;
    for(let i=0;i<count;i++){
      const x=(-.5+i/(count-1))*13.3;
      column(x,9.05,1.24,8.25,.37);
    }
    pediment(0,10.15,9.08,18,3.1,'ivory');
    if(hi){
      box(0,11.03,9.2,4.9,.33,.22,'gold');
      // Decorative lyre motif in the tympanum.
      beam([-1.2,10.72,9.24],[0,12.06,9.24],.1,'gold');
      beam([1.2,10.72,9.24],[0,12.06,9.24],.1,'gold');
      ball(0,11.3,9.35,.25,'gold');
    }
    for(const x of [-4.1,0,4.1])facadeArch(8.3,x,1.24,8.39,2.25,4.25,{entrance:true,frame:'stone'});
    const sideN=lo?2:4;
    for(const sign of [-1,1])for(let i=0;i<sideN;i++)arch(sign*9.7,5.1,-5.6+i*(10/(sideN-1)),1.25,2.4,{glass:'glassLight',side:sign});
    if(!lo){
      for(const x of [-7.7,7.7]){
        box(x,6.8,8.6,.5,5,.28,'stone');
        if(hi){ball(x,9.37,8.65,.38,'gold');}
      }
    }
    stairs(10.16,17,6,.207);
  };

  const museum=()=>{
    const museumFoundation=box(0,.28,-.3,24.9,.56,18.9,'stone');
    museumFoundation.userData.landmarkColumnSupport=true;
    box(0,5.15,-1.6,22.5,9.3,14.6,'plaster');
    box(0,9.95,-1.6,23,.56,15.2,'ivory');
    hipRoof(0,10.2,-1.6,23,15,2.5,'slate');
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
    pediment(0,9.84,8.78,18.2,3.1,'ivory');
    // All openings lie against the actual 8.05 m front wall.
    facadeArch(8.05,0,1.0,8.13,2.85,4.6,{entrance:true,frame:'stone'});
    for(const x of [-4.3,4.3])facadeArch(8.05,x,2.75,8.13,1.9,4.1,{glass:'glassLight',frame:'stone'});
    for(const sign of [-1,1])for(let i=0;i<(lo?2:4);i++)arch(sign*11.32,3.9,-6.8+i*3.6,1.18,2.85,{glass:'glassLight',side:sign});
    if(!lo){
      for(const x of [-9.4,9.4]){
        box(x,1.52,8.55,1.35,1.95,1.35,'stone');
        const sculpture=ball(x,2.97,8.55,.7,'ivory',hi?18:10);sculpture.scale.y=1.25;
        if(hi)cyl(x,3.44,8.55,.26,.25,.6,'ivory',8);
      }
    }
    stairs(9.16,18,4,.14);
  };

  const townhall=()=>{
    box(0,.28,-.6,19.6,.56,14.8,'stone');
    box(0,6.3,-1,18.4,11.8,13,'cream');
    box(0,1.25,-1,18.9,2.15,13.4,'stone');
    wedge(0,12.15,-1,18.8,13.6,4.0,'slate');
    // Public arcaded ground floor, dark inset archways.
    const count=lo?3:5;
    for(let i=0;i<count;i++){
      const x=-7.0+i*(14/(count-1));
      arch(x,1.0,5.65,1.8,3.3,{glass:i===(count-1)/2?'wood':'shadow',frame:'ivory',entrance:i===(count-1)/2});
      if(!lo)arch(x,7.0,5.69,1.35,2.3,{glass:'glassLight',frame:'ivory'});
    }
    for(const sign of [-1,1])for(let i=0;i<(lo?2:3);i++)arch(sign*9.26,6,-4.5+i*3.65,1.2,2.5,{glass:'glassLight',side:sign});
    box(0,4.4,6.3,6.1,.32,2.1,'stone'); // balcony
    if(!lo){
      for(let i=0;i<9;i++)box(-2.6+i*.65,5.03,7.2,.13,1.05,.13,'iron');
      box(0,5.55,7.2,6,.18,.2,'iron');
    }
    // Tall municipal tower, clock set into the front wall above the roofline.
    box(0,16.1,-1.1,5.7,11.4,5.6,'ivory');
    for(const y of [12.0,17.9,21.9])box(0,y,-1.1,6.05,.45,6.0,'stone');
    clock(0,18.9,1.85,1.45);
    arch(0,14.0,1.84,1.6,2.5,{glass:'shadow',frame:'stone'});
    if(!lo){
      for(const sign of [-1,1])arch(sign*2.9,14,-1.15,1.12,2.7,{glass:'shadow',side:sign});
      for(const x of [-2.7,2.7])cyl(x,22.7,1.2,.25,.25,1.2,'gold',8);
    }
    box(0,22.55,-1.1,6.3,.65,6.2,'stone');
    cone(0,26.05,-1.1,4.2,6.2,'copper',4);
    cyl(0,29.3,-1.1,.12,.12,1.4,'gold',8);
    ball(0,30.15,-1.1,.4,'gold',10);
    stairs(6.85,8.6,4,.14);
  };

  const palace=()=>{
    box(0,.35,-1,41.6,.7,24.3,'stone');
    const wing=(x,w)=>{
      box(x,6.1,-2.1,w,11,16,'plaster');
      box(x,1.2,-2.1,w+.4,2.0,16.4,'stone');
      box(x,11.65,-2.1,w+.3,.48,16.3,'ivory');
      hipRoof(x,12,-2.1,w+.1,16.1,3.8,'slate');
      const n=lo?3:hi?6:4;
      for(let i=0;i<n;i++){
        const xx=x+(i/(n-1)-.5)*(w-2.3);
        for(const yy of [3.2,7.5])arch(xx,yy,6.02,lo?1.0:1.28,lo?2.15:2.75,{glass:'glassLight',frame:'ivory'});
      }
    };
    wing(-12.7,13.1);wing(12.7,13.1);
    box(0,7.1,-2.1,13.8,13.2,16.2,'ivory');
    box(0,13.86,-2.1,14.3,.45,16.5,'stone');
    hipRoof(0,14.2,-2.1,14.1,16.2,4.4,'slate');
    // Colonnaded projecting central risalit.
    const palacePodium=box(0,2.15,7.25,11.9,3.1,4.0,'stone');
    palacePodium.userData.landmarkColumnSupport=true;
    box(0,10.88,8.3,12.7,.65,5.4,'ivory');
    for(const x of [-5.2,-3.1,-1.05,1.05,3.1,5.2])column(x,8.55,3.7,7.0,.35);
    pediment(0,11.22,9.24,13,3.0,'ivory');
    if(hi){
      const sun=ball(0,12.0,9.36,.45,'gold',16);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        beam([Math.cos(a)*.68,12+Math.sin(a)*.52,9.41],[Math.cos(a)*1.06,12+Math.sin(a)*.8,9.41],.065,'gold');
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
      box(x,7.15,z,4.2,12.8,4.15,'cream');
      for(const yy of [4.0,9.1])if(!lo)arch(x,yy,z+2.13,1.25,2.65,{glass:'glassLight',frame:'ivory'});
      box(x,13.68,z,4.6,.5,4.7,'stone');
      cone(x,16.22,z,3.0,5.3,'slate',4);
      if(!lo)ball(x,19.03,z,.26,'gold',10);
    }
    stairs(9.36,11.6,14,3.7/14);
    if(!lo){
      // Front ornamental balustrades and flower planters.
      for(const x of [-15.2,-13.9,-12.6,-11.3,11.3,12.6,13.9,15.2]){
        box(x,6.75,6.2,.21,1.05,.2,'ivory');
        ball(x,7.42,6.2,.17,'stone',8);
      }
      for(const x of [-8.2,8.2]){
        box(x,.95,10.5,1.5,1.25,1.5,'stone');
        if(hi)ball(x,1.75,10.5,.5,'grass');
      }
    }
  };

  ({church,theater,museum,townhall,palace}[id])();
  const stats=landmarkTriangleCount(root);
  // Model-level resources are owned by this instance only; never dispose
  // imported city or house materials when changing the inspector's model.
  const dispose=()=>{
    const geos=new Set();root.traverse(o=>{if(o.isMesh)geos.add(o.geometry);});
    geos.forEach(g=>g.dispose());Object.values(m).forEach(mat=>mat.dispose());
  };
  return {group:root,dispose,stats,detail,id,entranceCount:(()=>{let count=0;root.traverse(o=>{if(o.userData.entrance)count++;});return count;})()};
}
