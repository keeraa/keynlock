import {loadFurnitureModel} from './furniture-models.js';

export function buildStorageTables(context){
 const {THREE,layout,root,box,m,disposable,onFurnitureLoaded}=context;
 const fallback=new THREE.Group();root.add(fallback);
 for(const table of layout.storageTables){
  const group=new THREE.Group();group.name=table.id;group.position.set(table.x,0,table.z);group.rotation.y=table.angle;fallback.add(group);
  box(0,table.y-table.thickness/2,0,table.width,table.thickness,table.depth,m.wood,group);
  for(const x of [-1,1])for(const z of [-1,1])box(x*(table.width/2-.14),(table.y-table.thickness)/2,z*(table.depth/2-.14),.11,table.y-table.thickness,.11,m.darkWood,group);
  box(0,.2,0,table.width-.18,.07,.08,m.darkWood,group);
 }
 fallback.traverse(node=>{if(node.isMesh)node.userData.skipStaticBatch=true;});
 if(!layout.storageTables.length)return;
 const url=new URL('../../assets/wooden-table-02/wooden_table_02.gltf',import.meta.url);
 loadFurnitureModel(context,url,scene=>{
  const {geometry,material}=scene.getObjectByName('wooden_table_02');
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const tables=new THREE.InstancedMesh(geometry,material,layout.storageTables.length);
  tables.name='Wooden Table 02';tables.castShadow=tables.receiveShadow=true;
  const pose=new THREE.Object3D(),offset=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
  for(const [index,table] of layout.storageTables.entries()){
   pose.position.set(table.x,0,table.z);pose.rotation.y=table.angle;
   pose.scale.set(table.width/size.x,table.y/size.y,table.depth/size.z);
   pose.updateMatrix();
   tables.setMatrixAt(index,pose.matrix.multiply(offset));
  }
  disposable.add(tables);root.add(tables);
  fallback.removeFromParent();
  fallback.traverse(node=>{if(node.isMesh && disposable.delete(node.geometry))node.geometry.dispose();});
  onFurnitureLoaded?.(tables);
 });
}
