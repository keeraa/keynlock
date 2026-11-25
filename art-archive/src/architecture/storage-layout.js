

export function storageTables(config){
 const settings=config.building.storageTables??{},count=settings.count??6,radius=settings.radius??(config.building.stair.openingRadius+(settings.depth??1.3)/2+.45);
 return Array.from({length:count},(_,i)=>{
  const angle=.8+(Math.PI*2-1.6)*(i+.5)/count;
  return {id:'table-'+i,kind:'table',room:'center',x:Math.sin(angle)*radius,z:Math.cos(angle)*radius,
   angle,width:settings.width??2.5,depth:settings.depth??1.3,y:settings.height??.86,thickness:.075};
 });
}

export function disposalReceiver(config){
 const floorY=-config.building.stair.depth;
 const bearing=2.05,width=2.5,bottom=1.01,height=.42;
 const arc=Math.asin(width/2/LOWER_WALL_RADIUS);
 const radius=LOWER_WALL_RADIUS*Math.cos(arc)-.07;
 return {...stairPoint(radius,bearing,floorY+bottom+height/2),bearing,angle:bearing+Math.PI,arc,width,bottom,height,floorY};
}
export function supportTables(layout){
 return [...(layout.storageTables??[]),
  ...(layout.rotundaFurniture??[]).filter(piece=>piece.kind==='table')];
}
import {LOWER_WALL_RADIUS,stairPoint} from './stair-profile.js';

