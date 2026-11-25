// Shared geometry and materials for freestanding trolleys and the rotunda collection seal.
import {TROLLEY,trolleyDimensions} from './trolley-model.js';
export function createPaintingProps(THREE,settings){
  const box=new THREE.BoxGeometry(),wheel=new THREE.CylinderGeometry(TROLLEY.wheelRadius,TROLLEY.wheelRadius,TROLLEY.wheelThickness,12);
  const wood=new THREE.MeshBasicMaterial({color:0x91724a}),steel=new THREE.MeshBasicMaterial({color:0x45403a});
  const gold=new THREE.MeshBasicMaterial({color:0xd8b766});
  const shape=new THREE.Shape();
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,r=i%2?.019:.05;
    const x=Math.sin(angle)*r,y=Math.cos(angle)*r;
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();const seal=new THREE.ShapeGeometry(shape);
  function cart(slot){
    const group=new THREE.Group();group.name='painting-trolley';
    const {bottom,span,baseOverhang,baseDrop,baseThickness,depth,wheelSpread,wheelDrop,wheelZ}=trolleyDimensions(slot,settings);
    function bar(material,x,y,z,w,h,d){
      const mesh=new THREE.Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);
    }
    bar(wood,0,bottom-baseDrop,0,span+baseOverhang,baseThickness,depth);
    for(let i=0;i<2;i++)bar(steel,(i-.5)*span*.82,bottom+slot.height*.31,-.085,.065,slot.height*.62,.075);
    for(let i=0;i<4;i++){
      const mesh=new THREE.Mesh(wheel,steel);mesh.rotation.x=Math.PI/2;
      mesh.position.set((i%2-.5)*span*wheelSpread,bottom-wheelDrop,(i<2?-1:1)*wheelZ);group.add(mesh);
    }
    return group;
  }
  function badge(slot){
    const mesh=new THREE.Mesh(seal,gold);mesh.name='masterpiece-seal';
    mesh.position.set(0,slot.height/2+settings.frameWidthM/2,settings.frameDepthM*.53+.002);
    return mesh;
  }
  return {cart,badge,dispose(){for(const resource of [box,wheel,seal,wood,steel,gold])resource.dispose();}};
}
