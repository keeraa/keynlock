import {RIVER_BANK_WIDTH} from './landscape-model.js';
import {paintFixedBridgeWater} from './keynlock-fixed-bridges.js';

// All waterways share ONE alpha mask and ONE painted water sheet. The union
// removes seams, darker overlapping ribbons, and shore bands inside a confluence.
const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

export function paintRiverUnion({rivers,water,shore,mask,output,width,height,ppm,worldWidth,worldDepth,
  referenceWater=null,referenceShore=null}){
  for(const ctx of [water,shore,mask])ctx.clearRect(0,0,width,height);
  if(!rivers.length&&!referenceWater)return;
  const point=p=>[(p[0]+worldWidth/2)*ppm,(p[1]+worldDepth/2)*ppm];
  const stroke=(ctx,river,extra,color)=>{
    if(river.points.length<2)return;
    ctx.beginPath();ctx.moveTo(...point(river.points[0]));
    for(let i=1;i<river.points.length;i++)ctx.lineTo(...point(river.points[i]));
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(.2,(river.width+extra)*ppm);ctx.stroke();
  };
  for(const ctx of [water,shore,mask]){ctx.lineJoin='round';ctx.lineCap='round';}

  // The fixed rivers and canals are one continuous top-down mask.
  // Editable river strokes join the SAME union and cannot paint dark seams.
  if(referenceWater)mask.drawImage(referenceWater,0,0,width,height);
  if(referenceWater)paintFixedBridgeWater(mask,{worldWidth,worldDepth,ppm});
  if(referenceShore)shore.drawImage(referenceShore,0,0,width,height);
  for(const river of rivers)stroke(mask,river,0,'#ffffff');

  // The rings are computed as one group and then cut away wherever ANY river
  // occupies land, leaving one exterior shoreline even for overlapping rivers.
  for(const river of rivers){
    stroke(shore,river,RIVER_BANK_WIDTH*3.3,'rgba(78,78,58,.075)');
    stroke(shore,river,RIVER_BANK_WIDTH*2.55,'rgba(126,105,72,.17)');
    stroke(shore,river,RIVER_BANK_WIDTH*1.7,'rgba(178,143,91,.27)');
    stroke(shore,river,RIVER_BANK_WIDTH*.8,'rgba(203,168,108,.36)');
    stroke(shore,river,1.1,'rgba(94,117,101,.45)');
  }
  shore.save();shore.globalCompositeOperation='destination-out';shore.drawImage(mask.canvas,0,0);shore.restore();
  output?.drawImage(shore.canvas,0,0);

  // Unlit gouache water with antialiased mask edges. Its color does not
  // depend on the camera angle or the order in which rivers were drawn.
  water.drawImage(mask.canvas,0,0);
  water.save();water.globalCompositeOperation='source-in';
  water.fillStyle='#578283';water.fillRect(0,0,width,height);water.restore();
  water.save();water.globalCompositeOperation='source-atop';
  for(const river of rivers){
    // Sparse, feather-light glints follow the current and remain inside the
    // union mask. No per-stroke centre bands can double over a confluence.
    const rand=seeded(9811+river.points.length*17+Math.round(river.width*31));
    for(let i=1;i<river.points.length;i++){
      const a=river.points[i-1],b=river.points[i];
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.2)continue;
      const nx=-dz/length,nz=dx/length;
      const count=Math.floor(length/3.8);
      for(let k=0;k<count;k++){
        const t=(k+.25+rand()*.5)/count,offset=(rand()-.5)*river.width*.78;
        const x=a[0]+dx*t+nx*offset,z=a[1]+dz*t+nz*offset;
        const [px,py]=point([x,z]),span=(.3+rand()*1.15)*ppm;
        water.beginPath();water.moveTo(px,py);
        water.lineTo(px+dx/length*span,py+dz/length*span);
        water.strokeStyle=rand()>.38?'rgba(183,204,182,.10)':'rgba(24,61,71,.08)';
        water.lineWidth=(.13+rand()*.24)*ppm;water.stroke();
      }
    }
  }
  water.restore();
  output?.drawImage(water.canvas,0,0);
}
