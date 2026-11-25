import {loadFurnitureModel} from './furniture-models.js';

export function placeRotundaFurniture(pieces,panels){
 return pieces.flatMap(piece=>{
  const wall=panels[piece.panel];
  if(!wall || wall.length<piece.width+.5)return [];
  const {a,b,normal}=wall,offset=piece.depth/2+.16;
  return [{...piece,room:'center',x:(a.x+b.x)/2+normal.x*offset,z:(a.z+b.z)/2+normal.z*offset,
   angle:Math.atan2(normal.x,normal.z)}];
 });
}

export function buildRotundaFurniture(context){
 const {THREE,layout,root,onFurnitureLoaded}=context;
 for(const piece of layout.rotundaFurniture){
  const url=new URL('../../assets/rotunda-furniture/'+piece.model+'/model.gltf',import.meta.url);
  loadFurnitureModel(context,url,scene=>{
   const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
   const center=bounds.getCenter(new THREE.Vector3());
   scene.scale.set(piece.width/size.x,piece.y/size.y,piece.depth/size.z);
   scene.position.set(-center.x*scene.scale.x,-bounds.min.y*scene.scale.y,-center.z*scene.scale.z);
   const holder=new THREE.Group();
   holder.name=piece.id;holder.position.set(piece.x,0,piece.z);holder.rotation.y=piece.angle;
   holder.add(scene);root.add(holder);
   onFurnitureLoaded?.(scene);
  });
 }
}
