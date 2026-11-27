import {createRoomIndex} from './room-index.js';
// Static architecture is batched by material, independently for cutaway layers.
export function batchStatic(THREE,root,layers){
 root.updateMatrixWorld(true);const batches=[],roomIndices=[];
 for(const layer of layers){
  const buckets=new Map(),inverse=layer.matrixWorld.clone().invert();
  layer.traverse(o=>{if(!o.isMesh||nearestLayer(o,layers)!==layer)return;const key=o.material;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);});
  for(const [material,objects]of buckets){
   if(objects.length===1)continue;
   const geometries=objects.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));return g;});
   const count=geometries.reduce((n,g)=>n+g.attributes.position.count,0),g=new THREE.BufferGeometry();
   for(const name of ['position','normal','uv']){
    const size=name==='uv'?2:3,data=new Float32Array(count*size);let offset=0;
    for(const piece of geometries){const a=piece.getAttribute(name);if(a)data.set(a.array,offset);offset+=piece.attributes.position.count*size;}
    g.setAttribute(name,new THREE.BufferAttribute(data,size));
   }
   indexVertices(THREE,g);
   // Roof groups already cull as a unit. Shared wall and floor materials can
   // span several wings as well as the rotunda in one batch.
   if(layer===root){
    const spans=[];let offset=0;
    for(let i=0;i<objects.length;i++){
     let owner=objects[i].parent;
     while(owner!==layer && !owner.userData.galleryId)owner=owner.parent;
     const room=owner.userData.galleryId;
     const end=offset+geometries[i].attributes.position.count;
     if(spans.length && spans.at(-1).room===room)spans.at(-1).end=end;
     else spans.push({room,start:offset,end});
     offset=end;
    }
    if(spans.some(s=>s.room))roomIndices.push(createRoomIndex(THREE,g,spans));
   }
   g.computeBoundingSphere();const merged=new THREE.Mesh(g,material);merged.castShadow=!material.transparent;merged.receiveShadow=true;merged.name='static:'+layer.name;batches.push(merged);
   for(const o of objects)o.removeFromParent();for(const piece of geometries)piece.dispose();layer.add(merged);
  }
 }
 return {count:batches.length,selectRooms(rooms){for(const select of roomIndices)select(rooms);},dispose(){for(const o of batches){o.geometry.dispose();o.removeFromParent();}}};
}
function nearestLayer(object,layers){
 for(let parent=object.parent;parent;parent=parent.parent)if(layers.includes(parent))return parent;
 return null;
}

// Compare all Float32 bit patterns, including signed zero. Spans still refer to
// the same ordered triangle corners after those corners acquire shared indices.
function indexVertices(THREE,geometry){
 const attrs=Object.entries(geometry.attributes);
 const bits=attrs.map(([,a])=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length));
 const count=geometry.attributes.position.count,heads=new Map(),next=[],sources=[],indices=[];
 for(let i=0;i<count;i++){
  let hash=2166136261;
  for(let k=0;k<attrs.length;k++){
   const size=attrs[k][1].itemSize;
   for(let j=0;j<size;j++)hash=Math.imul(hash^bits[k][i*size+j],16777619);
  }
  let index=heads.get(hash);
  while(index!==undefined){
   const source=sources[index];
   if(attrs.every(([,a],k)=>{
    for(let j=0;j<a.itemSize;j++)if(bits[k][i*a.itemSize+j]!==bits[k][source*a.itemSize+j])return false;
    return true;
   }))break;
   index=next[index];
  }
  if(index===undefined){
   index=sources.length;sources.push(i);next.push(heads.get(hash));heads.set(hash,index);
  }
  indices.push(index);
 }
 for(const [name,a] of attrs){
  const data=new Float32Array(sources.length*a.itemSize);
  for(let i=0;i<sources.length;i++)for(let j=0;j<a.itemSize;j++)data[i*a.itemSize+j]=a.array[sources[i]*a.itemSize+j];
  geometry.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));
 }
 geometry.setIndex(indices);
}
