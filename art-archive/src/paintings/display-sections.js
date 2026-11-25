import {mountedFrame} from '../../catalog/painting-geometry.js';

// Sort atlas triangles into contiguous wall bays. Culling uses the bounds of the
// actual frames, so a large painting extending into the next bay stays visible.
export function paintingSections(slots,layout,bayCount) {
  const rooms=new Map(layout?.halls.map(h=>[h.id,h]) ?? []);
  const sections=new Map();
  for(const slot of slots){
    const room=slot.floorRoom ?? slot.wall.hall, hall=rooms.get(room);
    let key=slot.wall.id;
    const mounted=mountedFrame(slot);
    if(hall && (!mounted || !slot.wall.id.endsWith('/end'))){
      const p=layout.local(hall,slot.x,slot.z);
      const bay=Math.max(0,Math.min(bayCount-1,Math.floor((p.z-hall.start)*bayCount/hall.length)));
      key=[room,mounted?'wall':'floor',Math.sign(p.x),bay].join('/');
    } else if(!mounted)key=room+'/floor';
    if(!sections.has(key))sections.set(key,{room,slots:[]});
    sections.get(key).slots.push(slot);
  }
  return [...sections.values()];
}
