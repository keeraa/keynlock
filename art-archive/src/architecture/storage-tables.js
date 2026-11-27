export function buildStorageTables({THREE,layout,root,box,m}){
 for(const table of layout.storageTables){
  const group=new THREE.Group();group.name=table.id;group.position.set(table.x,0,table.z);group.rotation.y=table.angle;root.add(group);
  box(0,table.y-table.thickness/2,0,table.width,table.thickness,table.depth,m.wood,group);
  for(const x of [-1,1])for(const z of [-1,1])box(x*(table.width/2-.14),(table.y-table.thickness)/2,z*(table.depth/2-.14),.11,table.y-table.thickness,.11,m.darkWood,group);
  box(0,.2,0,table.width-.18,.07,.08,m.darkWood,group);
 }
}
