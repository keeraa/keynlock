import {createDecalGeometry,createDecalMaterial} from '../rendering/surface-decals.js';

export function addInteriorFinishes(THREE,building,layout){
 const shadows=createDecalGeometry(THREE);
 for(const piece of [...layout.storageTables,...layout.rotundaFurniture]){
  const c=Math.cos(piece.angle),s=Math.sin(piece.angle);
  const u=[c,0,-s],v=[-s,0,-c];
  const floor=(along,across,width,height,feather,opacity)=>shadows.add({
   x:piece.x+along*c+across*s,z:piece.z-along*s+across*c,y:.003,
   u,v,width,height,feather,opacity,
  });
  floor(0,0,piece.width*.88,piece.depth*.86,.27,.21);
  for(const i of [-1,1])for(const j of [-1,1]){
   floor(i*piece.width*.42,j*piece.depth*.36,.13,.12,.12,.23);
  }
 }
 const accents=createDecalGeometry(THREE);
 for(const wall of layout.walls.filter(w=>w.hall==='center')){
  const n=wall.normal;
  accents.add({
   x:(wall.a.x+wall.b.x)/2+n.x*.004,z:(wall.a.z+wall.b.z)/2+n.z*.004,y:3.95,
   u:[n.z,0,-n.x],v:[0,1,0],width:Math.max(.3,wall.length-.54),height:4.7,feather:.12,opacity:.16,
  });
 }
 const floorShadow=new THREE.Mesh(shadows.build(),createDecalMaterial(THREE,{color:0x2e231f}));
 const focusLight=new THREE.Mesh(accents.build(),createDecalMaterial(THREE,{color:0xffddb1,light:true}));
 floorShadow.name='furniture-contact-shadows';floorShadow.renderOrder=1;
 focusLight.name='masterpiece-wall-light';
 for(const mesh of [floorShadow,focusLight]){
  mesh.raycast=()=>{};building.root.add(mesh);
 }
 return {dispose(){for(const mesh of [floorShadow,focusLight]){
  mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
 }}};
}
