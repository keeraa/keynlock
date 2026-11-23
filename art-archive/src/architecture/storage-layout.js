export function storageTables(config){
 const settings=config.building.storageTables??{},count=settings.count??6,radius=settings.radius??5.25;
 return Array.from({length:count},(_,i)=>{
  const angle=.8+(Math.PI*2-1.6)*(i+.5)/count;
  return {id:'table-'+i,kind:'table',room:'center',x:Math.sin(angle)*radius,z:Math.cos(angle)*radius,
   angle,width:settings.width??2.5,depth:settings.depth??1.3,y:settings.height??.86,thickness:.075};
 });
}
