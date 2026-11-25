import {patchShadowHatch} from '../rendering/shadow-hatch.js';

// Transfer ownership after loading, including when the host has already closed.
export function loadFurnitureModel({loadModel,disposable},url,install){
 if(!loadModel)return;
 let disposed=false;
 disposable.add({dispose(){disposed=true;}});
 return loadModel(url.href).then(({scene})=>{
  const resources=new Set(),meshes=[];
  scene.traverse(node=>{
   if(!node.isMesh)return;
   meshes.push(node);
   resources.add(node.geometry);
   for(const material of Array.isArray(node.material)?node.material:[node.material]){
    resources.add(material);
    for(const map of Object.values(material))if(map?.isTexture)resources.add(map);
   }
  });
  if(disposed){for(const resource of resources)resource.dispose();return;}
  for(const resource of resources)disposable.add(resource);
  for(const mesh of meshes){
   mesh.castShadow=mesh.receiveShadow=true;
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])patchShadowHatch(material);
  }
  install(scene);
 }).catch(error=>console.warn('Could not load furniture',url.pathname,error));
}
