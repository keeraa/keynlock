// Sort atlas triangles into contiguous wall bays. Culling uses the bounds of the
// actual frames, so a large painting extending into the next bay stays visible.
export function paintingSections(slots,layout,bayCount) {
  const rooms=new Map(layout?.halls.map(h=>[h.id,h]) ?? []);
  const sections=new Map();
  for(const slot of slots){
    const room=slot.floorRoom ?? slot.wall.hall, hall=rooms.get(room);
    let key=slot.wall.id;
    if(hall && (slot.floorAngle!==undefined || !slot.wall.id.endsWith('/end'))){
      const p=layout.local(hall,slot.x,slot.z);
      const bay=Math.max(0,Math.min(bayCount-1,Math.floor((p.z-hall.start)*bayCount/hall.length)));
      key=[room,slot.floorAngle===undefined?'wall':'floor',Math.sign(p.x),bay].join('/');
    } else if(slot.floorAngle!==undefined)key=room+'/floor';
    if(!sections.has(key))sections.set(key,{room,slots:[]});
    sections.get(key).slots.push(slot);
  }
  return [...sections.values()];
}
