// Static street/city representation of the editable reference house.
// Material batches retain UVs and normals. Stable shell geometry is kept
// separate from fading details even when they share a paint material.

function combineGeometries(THREE, sources) {
  const vertexCount=sources.reduce((sum,g)=>sum+g.getAttribute('position').count,0);
  const indexCount=sources.reduce((sum,g)=>sum+(g.index?.count??g.getAttribute('position').count),0);
  const positions=new Float32Array(vertexCount*3);
  const normals=new Float32Array(vertexCount*3);
  const uvs=new Float32Array(vertexCount*2);
  const indices=new (vertexCount>65535?Uint32Array:Uint16Array)(indexCount);
  let vertexOffset=0,indexOffset=0;
  for(const source of sources) {
    const pos=source.getAttribute('position');
    let norm=source.getAttribute('normal');
    if(!norm){source.computeVertexNormals();norm=source.getAttribute('normal');}
    const uv=source.getAttribute('uv');
    positions.set(pos.array,vertexOffset*3);
    normals.set(norm.array,vertexOffset*3);
    if(uv)uvs.set(uv.array,vertexOffset*2);
    const srcIndices=source.index?.array;
    if(srcIndices)for(let i=0;i<srcIndices.length;i++)indices[indexOffset+i]=srcIndices[i]+vertexOffset;
    else for(let i=0;i<pos.count;i++)indices[indexOffset+i]=i+vertexOffset;
    vertexOffset+=pos.count;
    indexOffset+=srcIndices?.length??pos.count;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

export function batchHouseGeometry(THREE,root) {
  root.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const batches=new Map(),oldMeshes=[];
  root.traverse(object=>{
    if(!object.isMesh)return;
    if(Array.isArray(object.material))throw new Error('Объединение требует единственного материала на объект');
    oldMeshes.push(object);
    let materialBatches=batches.get(object.material);
    if(!materialBatches){materialBatches=new Map();batches.set(object.material,materialBatches);}
    const invariant=Boolean(object.userData.houseInvariant);
    let batch=materialBatches.get(invariant);
    if(!batch){batch={material:object.material,invariant,sources:[],cast:false,receive:false};materialBatches.set(invariant,batch);}
    const geometry=object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    batch.sources.push(geometry);
    batch.cast ||= object.castShadow;
    batch.receive ||= object.receiveShadow;
  });
  if(!oldMeshes.length)return {before:0,after:0,triangles:0};
  const optimized=[];
  for(const batch of [...batches.values()].flatMap(group=>[...group.values()])){
    const geometry=combineGeometries(THREE,batch.sources);
    const mesh=new THREE.Mesh(geometry,batch.material);
    mesh.name='Городской дом · объединённые детали';
    mesh.userData.houseInvariant=batch.invariant;
    mesh.castShadow=batch.cast;mesh.receiveShadow=batch.receive;
    optimized.push(mesh);
    batch.sources.forEach(source=>source.dispose());
  }
  const triangles=optimized.reduce((sum,mesh)=>sum+mesh.geometry.index.count/3,0);
  const originalGeometries=new Set(oldMeshes.map(mesh=>mesh.geometry));
  root.clear();
  originalGeometries.forEach(geometry=>geometry.dispose());
  root.add(...optimized);
  root.userData.optimization={before:oldMeshes.length,after:optimized.length,triangles};
  return root.userData.optimization;
}
