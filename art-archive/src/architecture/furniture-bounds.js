// Adapt solid furniture to the same oriented-box contract used for paintings.
export function furnitureBounds(layout,settings){
 return (layout?.storageTables??[]).map(t=>({x:t.x,y:t.y/2,z:t.z,width:t.width,
  height:t.y-2*settings.frameWidthM,depth:t.depth,normal:{x:Math.sin(t.angle),z:Math.cos(t.angle)}}));
}
