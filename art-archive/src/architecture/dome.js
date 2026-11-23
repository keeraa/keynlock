export function buildDome(context){
 const {THREE, m, roofs, r, domeBase, mesh, tube}=context;
 // Transparent glass cupola: clear panes on a slender brass structural frame.
 const domeMat=m.glass;
 const dome=mesh(new THREE.SphereGeometry(r,48,20,0,Math.PI*2,0,Math.PI/2),domeMat,roofs);dome.name='glass-dome';dome.scale.y=.45;dome.position.y=domeBase;dome.castShadow=false;dome.receiveShadow=false;
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,points=[];
  for(let j=0;j<=20;j++){const t=j/20*Math.PI/2;points.push(new THREE.Vector3(Math.sin(t)*r*Math.sin(a),domeBase-.04+Math.cos(t)*r*.45,Math.sin(t)*r*Math.cos(a)));}
  tube(points,.045,m.gold,roofs);
 }
 for(const offset of [0,1.3,3,4.6]){
  const yy=domeBase+offset;
  const rr=r*Math.sqrt(1-((yy-domeBase)/(r*.45))**2);
  const o=mesh(new THREE.TorusGeometry(rr,.04,5,80),m.gold,roofs);o.rotation.x=Math.PI/2;o.position.y=yy;
 }

}
