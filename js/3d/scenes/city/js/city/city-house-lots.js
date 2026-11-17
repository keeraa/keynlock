// Deterministic parcel reservation for the city. The approved facade models
// are assembled separately; this module only owns lots and door approaches.
export function populateCityHouseLots({random,atPolyline,riverPoints,isBuildable,
  occupiedLots,newHousePlacements,houseEntrances,windowLightSites,
  heightAt,foundationDepth,local}){
  function house(x,z,style='old',scale=1,angle=0){
    const size=style==='upper'?1.27:style==='industrial'?1.2:style==='port'?1.17:1;
    const w=(2.2+random()*1.6)*scale*size;
    const d=(2.8+random()*1.7)*scale*size;
    const h=(2.4+random()*2.35)*scale*(style==='upper'?1.29:style==='port'?.88:1);
    // Preserve the historical roof draw so subsequent seeded lots are stable.
    random();
    const halfX=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d)/2+.24;
    const halfZ=(Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*d)/2+.24;
    const corners=[[x-halfX,z-halfZ],[x+halfX,z-halfZ],[x-halfX,z+halfZ],[x+halfX,z+halfZ]];
    const midpoints=[[x,z],[x-halfX,z],[x+halfX,z],[x,z-halfZ],[x,z+halfZ]];
    if([...corners,...midpoints].some(([px,pz])=>atPolyline(px,pz,riverPoints)<5.3))return false;
    if(corners.some(([px,pz])=>!isBuildable(px,pz,.35)))return false;
    if(occupiedLots.some(lot=>Math.abs(x-lot.x)<halfX+lot.halfX+.48&&Math.abs(z-lot.z)<halfZ+lot.halfZ+.48))return false;
    occupiedLots.push({x,z,halfX,halfZ,style});
    const styleKey=style==='hill'?'palace':style;
    const variant=Math.abs(Math.floor(x*19+z*37))%12;
    const key=`${styleKey}-${variant}`;
    if(!newHousePlacements.has(key))newHousePlacements.set(key,[]);
    newHousePlacements.get(key).push({x,z,angle,width:w,depth:d,ground:heightAt(x,z),foundation:foundationDepth(x,z,halfX,halfZ)});
    const [doorX,doorZ]=local(x,z,0,d/2-.08,angle);
    houseEntrances.push({x:doorX,z:doorZ,forward:[Math.sin(angle),Math.cos(angle)],lot:occupiedLots[occupiedLots.length-1]});
    if(variant%3!==0)windowLightSites.push({x:doorX,y:heightAt(x,z)+h*.68,z:doorZ});
    return true;
  }

  const zones=[
    {name:'industrial',x0:-109,x1:-73,z0:-64,z1:-11,target:30},
    {name:'old',x0:-54,x1:-10,z0:-12,z1:14,target:30},
    {name:'bohemian',x0:-12,x1:18,z0:-17,z1:14,target:23},
    {name:'arts',x0:18,x1:57,z0:-11,z1:14,target:27},
    {name:'upper',x0:18,x1:57,z0:-42,z1:-13,target:22},
    // Distinct houses flank the stairway outside the palace walls.
    {name:'hill',x0:-25,x1:-6,z0:-84,z1:-37,target:17},
    {name:'hill',x0:19,x1:34,z0:-81,z1:-36,target:19},
    {name:'port',x0:-55,x1:55,z0:11,z1:20,target:15},
  ];
  for(const zone of zones){
    let placed=0;
    for(let attempt=0;attempt<2600&&placed<zone.target;attempt++){
      const x=zone.x0+random()*(zone.x1-zone.x0);
      const z=zone.z0+random()*(zone.z1-zone.z0);
      if(!isBuildable(x,z,.45))continue;
      const scale=zone.name==='port'?.83:zone.name==='industrial'?.78+random()*.17:zone.name==='upper'?.97:zone.name==='hill'?.68+random()*.33:.8+random()*.22;
      const angle=zone.name==='port'?0:(attempt%3===0?Math.PI*.5:0);
      if(house(x,z,zone.name,scale,angle))placed++;
    }
  }
  // Infill respects existing district neighbors and keeps the streets open.
  const infill=[
    {name:'old',x0:-55,x1:-10,z0:-12,z1:15,target:9},
    {name:'bohemian',x0:-12,x1:18,z0:-17,z1:15,target:7},
    {name:'arts',x0:18,x1:57,z0:-10,z1:15,target:7},
    {name:'port',x0:-55,x1:55,z0:11,z1:19,target:10},
  ];
  for(const zone of infill){
    let count=0;
    for(let attempt=0;attempt<1600&&count<zone.target;attempt++){
      const x=zone.x0+random()*(zone.x1-zone.x0);
      const z=zone.z0+random()*(zone.z1-zone.z0);
      if(!isBuildable(x,z,.32))continue;
      if(!occupiedLots.some(lot=>lot.style===zone.name&&Math.hypot(lot.x-x,lot.z-z)<8.8))continue;
      const angle=zone.name==='port'?0:(attempt%4===0?Math.PI/2:0);
      if(house(x,z,zone.name,.69+random()*.11,angle))count++;
    }
  }
}
