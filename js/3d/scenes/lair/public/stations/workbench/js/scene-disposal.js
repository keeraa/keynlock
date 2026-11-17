// Three.js assets may be shared by dozens of meshes. Dispose each GPU resource
// exactly once when the workbench is destroyed or re-created.
export function disposeSceneResources(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const collectMaterial=material=>{
    if(!material||materials.has(material))return;
    materials.add(material);
    for(const value of Object.values(material)){
      if(value?.isTexture)textures.add(value);
    }
    if(material.uniforms){
      for(const uniform of Object.values(material.uniforms)){
        if(uniform?.value?.isTexture)textures.add(uniform.value);
      }
    }
  };
  root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material])
      collectMaterial(material);
  });
  for(const geometry of geometries)geometry.dispose();
  for(const texture of textures)texture.dispose();
  for(const material of materials)material.dispose();
  return {geometries:geometries.size,textures:textures.size,materials:materials.size};
}
