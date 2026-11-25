const interval=1000/60;
const timestampTolerance=.65;

export function createFrameLimit(){
 let enabled=false,nextFrame=-Infinity;
 return {
  setEnabled(value){
   enabled=value;
   nextFrame=-Infinity;
  },
  shouldRender(now){
   if(!enabled)return true;
   if(now+timestampTolerance<nextFrame)return false;
   // Carry timing across refresh ticks, but discard missed frames after a stall.
   nextFrame=now-nextFrame>=interval?now+interval:nextFrame+interval;
   return true;
  },
 };
}
