// Quays, warehouse yards and animated boats on the coastal city map.
export function createCityWaterfront(ctx) {
  const {T,scene,materials,part,coast,heightAt,foundationDepth,pierLayouts,waterfrontWarehouses,boats,boatSails,effectMaterials}=ctx;
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
  return {portAndQuays,boatsAndWaves};
}
