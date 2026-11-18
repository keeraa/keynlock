// A broken-edged, pressure-sensitive brush for the cover's canvas dust layer.
// Speed is measured in workbench-space units per second, not screen pixels.
export function dustCleaningStrength(speed){
  const motion=Math.min(1,Math.max(0,Number(speed)||0)/3.5);
  return .045+.66*motion*motion;
}

export function createDustCleaningBrush({context,random=Math.random,onChange=()=>{}}){
  function stamp(x,y,speed=0){
    const strength=dustCleaningStrength(speed);
    const radius=31+Math.min(1,Math.max(0,speed)/3.5)*11;
    context.save();
    context.globalCompositeOperation='destination-out';
    // Each stamp has its own irregular perimeter. Offset overlapping patches
    // break up the smooth circles that made cleaned areas look artificial.
    for(let patch=0;patch<2;patch++){
      const px=x+(random()-.5)*radius*.39;
      const py=y+(random()-.5)*radius*.39;
      const size=radius*(patch===0?1:.46);
      const brush=context.createRadialGradient(px,py,size*.06,px,py,size);
      const alpha=strength*(patch===0?1:.52);
      brush.addColorStop(0,`rgba(0,0,0,${alpha})`);
      brush.addColorStop(.57,`rgba(0,0,0,${alpha*.86})`);
      brush.addColorStop(1,'rgba(0,0,0,0)');
      context.fillStyle=brush;
      context.beginPath();
      for(let n=0;n<=26;n++){
        const angle=n/26*Math.PI*2;
        const jagged=size*(.76+random()*.42);
        const vx=px+Math.cos(angle)*jagged;
        const vy=py+Math.sin(angle)*jagged;
        if(n===0)context.moveTo(vx,vy);
        else context.lineTo(vx,vy);
      }
      context.closePath();context.fill();
    }
    context.restore();onChange();
  }
  return {stamp};
}
