import {supportTables} from './storage-layout.js';
// Adapt solid furniture to the same oriented-box contract used for paintings.
export function furnitureBounds(layout,settings){
 const pieces=[...supportTables(layout??{}),...(layout?.rotundaFurniture??[]).filter(piece=>piece.kind!=='table')];
 return pieces.map(t=>({x:t.x,y:((t.floorY??0)+t.y)/2,z:t.z,width:t.width,
  height:t.y-(t.floorY??0)-2*settings.frameWidthM,depth:t.depth,normal:{x:Math.sin(t.angle),z:Math.cos(t.angle)}}));
}
