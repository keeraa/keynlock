// Only the five largest trolley paintings get the extra heavy scraping layer.
export function heaviestPaintingIds(slots,usesTrolley,count=5){
  const unique=new Map(slots.filter(usesTrolley).map(slot=>[slot.painting.id,slot]));
  const area=slot=>{
    const size=slot.painting.physicalSizeM;
    return (size?.width??slot.width)*(size?.height??slot.height);
  };
  return new Set([...unique.values()].sort((a,b)=>area(b)-area(a)||a.painting.id.localeCompare(b.painting.id))
    .slice(0,count).map(slot=>slot.painting.id));
}

export function createPaintingMotionAudio(setMotion){
  let previous=null;
  function reset(){previous=null;setMotion(null);}
  function update({playing,slot,large,heavy,placing,raised,position,wallPosition,now}){
    if(!playing||!slot||raised){reset();return;}
    const next={id:slot.painting.id,x:position.x,z:position.z,wall:wallPosition?{x:wallPosition.x,y:wallPosition.y}:null,now};
    if(!previous||previous.id!==next.id){previous=next;setMotion(null);return;}
    const dt=(now-previous.now)/1000;
    if(dt<=.001)return;
    const moving=Math.hypot(next.x-previous.x,next.z-previous.z)/dt>.025;
    const wallMoving=next.wall&&previous.wall&&Math.hypot(next.wall.x-previous.wall.x,next.wall.y-previous.wall.y)/dt>.025;
    setMotion(placing?(wallMoving?'wallSlide':null):large&&moving?(heavy?'heavyDrag':'trolley'):null);
    previous=next;
  }
  return {update,reset};
}

export function createFrameFitAudio(playSound){
  let previous=null;
  return {update(place){
    if(place&&place!==previous)playSound('frameFit');
    previous=place;
  }};
}
