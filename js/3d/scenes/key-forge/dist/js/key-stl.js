import * as THREE from '../vendor/three.js';

export function modelToSTL(group) {
  group.updateMatrixWorld(true);
  const triangles=[];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const normal=new THREE.Vector3(),edge1=new THREE.Vector3(),edge2=new THREE.Vector3();
  group.traverse(obj=>{
    if(!obj.isMesh||obj.userData.exportable===false)return;
    const geometry=obj.geometry;
    const positions=geometry.getAttribute('position');
    const indices=geometry.index;
    const count=indices?indices.count:positions.count;
    for(let i=0;i+2<count;i+=3) {
      const ia=indices?indices.getX(i):i,ib=indices?indices.getX(i+1):i+1,ic=indices?indices.getX(i+2):i+2;
      a.fromBufferAttribute(positions,ia).applyMatrix4(obj.matrixWorld);
      b.fromBufferAttribute(positions,ib).applyMatrix4(obj.matrixWorld);
      c.fromBufferAttribute(positions,ic).applyMatrix4(obj.matrixWorld);
      edge1.subVectors(b,a);edge2.subVectors(c,a);normal.crossVectors(edge1,edge2).normalize();
      if(normal.lengthSq()<.001)continue;
      triangles.push([normal.x,normal.y,normal.z,a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z]);
    }
  });
  const buffer=new ArrayBuffer(84+triangles.length*50);
  const view=new DataView(buffer);
  const header='KEYNLOCK - KEY FORGE / THREE.JS';
  for(let i=0;i<header.length;i++)view.setUint8(i,header.charCodeAt(i));
  view.setUint32(80,triangles.length,true);
  let offset=84;
  for(const triangle of triangles) {
    for(const value of triangle){view.setFloat32(offset,value,true);offset+=4;}
    view.setUint16(offset,0,true);offset+=2;
  }
  return new Blob([buffer],{type:'model/stl'});
}
