// Keep a single material draw. Change its triangle list only on a portal crossing
// or when a doorway enters/leaves the camera view. Vertex buffers stay on the GPU.
export function createRoomIndex(THREE,geometry,spans) {
  const original=geometry.index?.array;
  const count=original?.length ?? geometry.attributes.position.count;
  const IndexArray=geometry.attributes.position.count>65535 ? Uint32Array : Uint16Array;
  const full=original ?? IndexArray.from({length:count},(_,i)=>i);
  const attribute=new THREE.BufferAttribute(new IndexArray(full),1).setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(attribute);
  const active=spans.map(()=>true);
  return function select(rooms) {
    let changed=false;
    for (let i=0;i<spans.length;i++) {
      const id=spans[i].room, on=!id || !rooms || rooms.has(id);
      if (on!==active[i]) {active[i]=on;changed=true;}
    }
    if (!changed) return;
    let written=0;
    for (let i=0;i<spans.length;i++) {
      if (!active[i]) continue;
      const {start,end}=spans[i];
      attribute.array.set(full.subarray(start,end),written);
      written+=end-start;
    }
    geometry.setDrawRange(0,written);
    if (written) {
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,written);
      attribute.needsUpdate=true;
    }
  };
}
