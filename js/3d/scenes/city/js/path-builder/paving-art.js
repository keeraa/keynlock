// Shared, world-anchored gouache cobblestone sheet for the 3D scene and 2D plan.
// Every approach is cut from ONE surface: joins have continuous stones and no
// stacked ribbons, overlapping borders, or flickering intersection polygons.
import {LANDSCAPE_BOUNDS} from './landscape-model.js';
import {bridgePavingCutout} from './bridge-frame.js';
// Fixed GPU atlas resolution: the tighter city retains detailed paving.
export const PAVING_MAP=Object.freeze({...LANDSCAPE_BOUNDS,
  pixelsPerMetre:2640/LANDSCAPE_BOUNDS.width});
const {width:WORLD_W,depth:WORLD_D,pixelsPerMetre:PPM}=PAVING_MAP;
const WIDTH=WORLD_W*PPM,HEIGHT=WORLD_D*PPM;
// Smaller stones read as historical street setts at the city's isometric scale.
const TILE=360,COLUMNS=45,ROWS=50,STONE_W=TILE/COLUMNS,STONE_H=TILE/ROWS;
// Keep the APPROVED physical stone size from the original 12-pixel/metre
// editor even though the city uses a compact shared texture atlas.
// CanvasPattern scales only the repeating pigment, not the full road masks.
const ORIGINAL_PAVING_PPM=12;
export const PAVING_BASE_COLOR='#777b70';
export const PAVING_STONE_SIZE=Object.freeze({
  widthMetres:STONE_W/ORIGINAL_PAVING_PPM,
  heightMetres:STONE_H/ORIGINAL_PAVING_PPM,
  tileMetres:TILE/ORIGINAL_PAVING_PPM,
  patternScale:PPM/ORIGINAL_PAVING_PPM,
});
const COLORS=['#b7afa0','#c4b9a7','#a5a599','#d0bfa7','#9ca69c',
  '#b3b6a7','#a39d91','#d4c6ae','#979f98','#bdb6a5','#aaaa9d'];

function randomSeed(seed){
  let n=seed>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
const mod=(n,max)=>(n%max+max)%max;
function stoneCentre(row,column){
  const rand=randomSeed(48271+mod(row,ROWS)*9137+mod(column,COLUMNS)*107231);
  return [(column+.5+(rand()-.5)*.56)*STONE_W,
    (row+.5+(rand()-.5)*.56)*STONE_H];
}
// Clipped Voronoi cells form an organic, joined stone mosaic, including the
// periodically repeated tile edges. Adjacent paving has consistent stone size.
function stoneShape(row,column){
  const centre=stoneCentre(row,column),pad=STONE_W*1.7;
  let polygon=[[centre[0]-pad,centre[1]-pad],[centre[0]+pad,centre[1]-pad],
    [centre[0]+pad,centre[1]+pad],[centre[0]-pad,centre[1]+pad]];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dc&&!dr)continue;
    const other=stoneCentre(row+dr,column+dc);
    const vx=other[0]-centre[0],vy=other[1]-centre[1];
    const midX=(other[0]+centre[0])*.5,midY=(other[1]+centre[1])*.5;
    const side=point=>(point[0]-midX)*vx+(point[1]-midY)*vy;
    const clipped=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      const da=side(a),db=side(b);
      if(da<=0)clipped.push(a);
      if((da<0&&db>0)||(da>0&&db<0)){
        const t=da/(da-db);
        clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      }
    }
    polygon=clipped;
    if(!polygon.length)break;
  }
  const shrink=.86;
  return polygon.map(([x,y])=>[centre[0]+(x-centre[0])*shrink,
    centre[1]+(y-centre[1])*shrink]);
}
function stonePattern(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=TILE;
  const ctx=canvas.getContext('2d'),wash=randomSeed(27383);
  ctx.fillStyle='#777c70';ctx.fillRect(0,0,TILE,TILE);
  for(let row=-1;row<=ROWS;row++)for(let column=-1;column<=COLUMNS;column++){
    const rand=randomSeed(39731+mod(row,ROWS)*12713+mod(column,COLUMNS)*22987);
    const polygon=stoneShape(row,column);
    if(polygon.length<3)continue;
    const c=COLORS[Math.floor(rand()*COLORS.length)];
    ctx.beginPath();
    ctx.moveTo(...polygon[0]);
    for(const p of polygon.slice(1))ctx.lineTo(...p);
    ctx.closePath();
    ctx.fillStyle=c;ctx.fill();
    // Light catches the uneven upper-left edges; the opposite edges gather
    // cool pigment. Each stone gets a quiet gouache relief without extra mesh.
    const centre=stoneCentre(row,column);
    const relief=ctx.createLinearGradient(centre[0]-STONE_W*.5,centre[1]-STONE_H*.45,
      centre[0]+STONE_W*.55,centre[1]+STONE_H*.58);
    relief.addColorStop(0,'rgba(255,245,210,.27)');
    relief.addColorStop(.45,'rgba(246,231,200,.015)');
    relief.addColorStop(1,'rgba(51,63,57,.24)');
    ctx.fillStyle=relief;ctx.fill();
    ctx.lineWidth=.55;ctx.strokeStyle='rgba(53,61,56,.31)';ctx.stroke();
    const top=polygon.reduce((best,p)=>p[1]<best[1]?p:best,polygon[0]);
    ctx.beginPath();ctx.moveTo(centre[0]-.9,top[1]+1.25);
    ctx.lineTo(centre[0]+1.5,top[1]+1.2);
    ctx.strokeStyle='rgba(255,247,220,.36)';ctx.lineWidth=.75;ctx.stroke();
    for(let fleck=0;fleck<3;fleck++){
      const fx=centre[0]+(rand()-.5)*STONE_W*.48;
      const fy=centre[1]+(rand()-.5)*STONE_H*.48;
      ctx.fillStyle=rand()>.5?'rgba(255,249,226,.22)':'rgba(57,67,62,.19)';
      ctx.fillRect(fx,fy,.6+rand()*1.7,.45+rand()*.75);
    }
    // Infrequent dark dust or moss caught in the irregular joints.
    if(rand()<.095){
      const edge=polygon[Math.floor(rand()*polygon.length)];
      ctx.fillStyle=rand()>.45?'rgba(87,109,73,.39)':'rgba(92,90,69,.3)';
      ctx.fillRect(edge[0]-.4,edge[1]-.3,1+rand()*1.6,.6+rand());
    }
  }
  // Broad, translucent pigment washes break up the stamp-like uniformity.
  for(let i=0;i<82;i++){
    const x=wash()*TILE,y=wash()*TILE,r=7+wash()*30;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
    const dark=wash()>.5;
    gradient.addColorStop(0,dark?'rgba(79,91,82,.095)':'rgba(245,221,178,.10)');
    gradient.addColorStop(1,'rgba(133,130,109,0)');
    ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  return canvas;
}

const signature=path=>path.p.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(';');
const length=points=>points.slice(1).reduce((total,p,i)=>
  total+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
function partial(points,fraction){
  if(fraction>=1)return points;
  const target=length(points)*fraction,result=[points[0]];
  let travelled=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],segment=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(travelled+segment>=target){
      const t=segment?Math.max(0,(target-travelled)/segment):0;
      result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      break;
    }
    result.push(b);travelled+=segment;
  }
  return result;
}
const texturePoint=p=>[(p[0]+WORLD_W/2)*PPM,(p[1]+WORLD_D/2)*PPM];
function trace(ctx,points){
  ctx.beginPath();ctx.moveTo(...texturePoint(points[0]));
  // Smooth the underlying right-angle grid as short stone-built sweeps. The
  // graph keeps its exact path cells, so navigation remains deterministic.
  for(let i=1;i<points.length-1;i++){
    const previous=points[i-1],corner=points[i],next=points[i+1];
    const before=Math.hypot(corner[0]-previous[0],corner[1]-previous[1]);
    const after=Math.hypot(next[0]-corner[0],next[1]-corner[1]);
    if(before<.0001||after<.0001){ctx.lineTo(...texturePoint(corner));continue;}
    const incoming=[(corner[0]-previous[0])/before,(corner[1]-previous[1])/before];
    const outgoing=[(next[0]-corner[0])/after,(next[1]-corner[1])/after];
    const turn=Math.abs(incoming[0]*outgoing[1]-incoming[1]*outgoing[0]);
    if(turn<.07){ctx.lineTo(...texturePoint(corner));continue;}
    const radius=Math.min(.82,before*.34,after*.34);
    ctx.lineTo(...texturePoint([corner[0]-incoming[0]*radius,corner[1]-incoming[1]*radius]));
    ctx.quadraticCurveTo(...texturePoint(corner),
      ...texturePoint([corner[0]+outgoing[0]*radius,corner[1]+outgoing[1]*radius]));
  }
  ctx.lineTo(...texturePoint(points.at(-1)));
}
function stroke(ctx,paths,extra,color){
  ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  for(const path of paths){
    if(path.points.length<2)continue;
    trace(ctx,path.points);ctx.lineWidth=(path.width+extra)*PPM;ctx.stroke();
  }
}
function fillForecourts(ctx,plazas,extra,color){
  ctx.fillStyle=color;
  for(const plaza of plazas){
    const [x,y]=texturePoint([plaza.x,plaza.z]);
    const hw=(plaza.width+extra)*PPM/2,hd=(plaza.depth+extra)*PPM/2;
    const r=Math.min(1.25*PPM,hw*.28,hd*.35);
    ctx.save();ctx.translate(x,y);ctx.rotate(-(plaza.rotation||0));
    ctx.beginPath();
    ctx.moveTo(-hw+r,-hd);ctx.lineTo(hw-r,-hd);
    ctx.quadraticCurveTo(hw,-hd,hw,-hd+r);
    ctx.lineTo(hw,hd-r);ctx.quadraticCurveTo(hw,hd,hw-r,hd);
    ctx.lineTo(-hw+r,hd);ctx.quadraticCurveTo(-hw,hd,-hw,hd-r);
    ctx.lineTo(-hw,-hd+r);ctx.quadraticCurveTo(-hw,-hd,-hw+r,-hd);
    ctx.closePath();ctx.fill();ctx.restore();
  }
}

const MODES=['auto','walk','street'];
function visibleWidth(path,mode){
  const type=mode==='auto'?(path.pavingType||'walk'):mode;
  return Math.max(type==='street'?2.72:1.66,path.width||0);
}
function drawEdgeWear(ctx,paths){
  // Sparse, stable edge sediment blends the constructed street into soil.
  for(const path of paths){
    if(path.points.length<2)continue;
    let seed=0;
    for(const p of path.points)seed=(seed+Math.round(p[0]*17+p[1]*31))>>>0;
    const rand=randomSeed(seed+39713);
    for(let i=1;i<path.points.length;i++){
      const a=path.points[i-1],b=path.points[i];
      const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
      if(l<1.2)continue;
      const nx=-dz/l,nz=dx/l;
      const count=Math.floor(l/2.4);
      for(let k=0;k<count;k++){
        if(rand()<.42)continue;
        const t=(k+.25+rand()*.5)/count;
        const side=rand()>.5?1:-1;
        const offset=side*(path.width*.5+.055+rand()*.2);
        const [x,y]=texturePoint([a[0]+dx*t+nx*offset,a[1]+dz*t+nz*offset]);
        for(let fleck=0;fleck<3;fleck++){
          ctx.fillStyle=rand()>.5?'rgba(93,111,68,.24)':'rgba(115,99,75,.18)';
          ctx.fillRect(x+(rand()-.5)*7,y+(rand()-.5)*5,.8+rand()*2.8,.5+rand()*1.8);
        }
      }
    }
  }
}

function paintRevealProgress(ctx,paths,mode){
  // Green is reserved for the road-coverage channel, so initialize it to 0.
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const path of paths){
    const distance=length(path.p);
    if(distance<=0)continue;
    let travelled=0;
    for(let i=1;i<path.p.length;i++){
      const a=texturePoint(path.p[i-1]),b=texturePoint(path.p[i]);
      const segment=Math.hypot(path.p[i][0]-path.p[i-1][0],path.p[i][1]-path.p[i-1][1]);
      if(!segment)continue;
      const gradient=ctx.createLinearGradient(...a,...b);
      const gray=f=>{const channel=Math.round(Math.max(0,Math.min(1,f))*255).toString(16).padStart(2,'0');return `#${channel}0000`;};
      gradient.addColorStop(0,gray(travelled/distance));
      gradient.addColorStop(1,gray((travelled+segment)/distance));
      ctx.strokeStyle=gradient;ctx.lineWidth=(visibleWidth(path,mode)+2.25)*PPM;
      ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
      travelled+=segment;
    }
  }
}

function coverageBounds(paths,plazas,mode){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const include=(x,z,radius)=>{
    const [px,py]=texturePoint([x,z]);
    minX=Math.min(minX,px-radius);minY=Math.min(minY,py-radius);
    maxX=Math.max(maxX,px+radius);maxY=Math.max(maxY,py+radius);
  };
  for(const path of paths){
    const radius=(visibleWidth(path,mode)/2+3)*PPM;
    for(const [x,z] of path.p)include(x,z,radius);
  }
  for(const plaza of plazas){
    const radius=Math.hypot(plaza.width,plaza.depth)*PPM;
    include(plaza.x,plaza.z,radius);
  }
  if(!Number.isFinite(minX))return null;
  const left=Math.max(0,Math.floor(minX-3)),top=Math.max(0,Math.floor(minY-3));
  const right=Math.min(WIDTH,Math.ceil(maxX+3)),bottom=Math.min(HEIGHT,Math.ceil(maxY+3));
  return right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:null;
}
function encodeInteriorCoverage(progressCtx,maskCtx,area){
  if(!area)return;
  // A single atlas serves two independent purposes: red stores road-arrival
  // order for the animation, green stores antialiased interior coverage.
  // Work only in the city block covered by roads, not every pixel of the
  // 2640×1800 map. On small settlements this eliminates almost all of the
  // synchronous 38MB readback and 19MB writeback after each house edit.
  const {left,top,width,height}=area;
  const progress=progressCtx.getImageData(left,top,width,height);
  const mask=maskCtx.getImageData(left,top,width,height);
  for(let i=0;i<progress.data.length;i+=4)progress.data[i+1]=mask.data[i+3];
  progressCtx.putImageData(progress,left,top);
}

function resetArrival(progressCtx){
  progressCtx.fillStyle='#ff0000';
  progressCtx.fillRect(0,0,WIDTH,HEIGHT);
}

function clipRevealedPaths(ctx,paths,fraction,mode){
  ctx.beginPath();
  for(const path of paths){
    const points=partial(path.p,fraction);
    if(points.length<2)continue;
    const radius=(visibleWidth(path,mode)+2.25)*PPM/2;
    for(let i=1;i<points.length;i++){
      const a=texturePoint(points[i-1]),b=texturePoint(points[i]);
      const dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy);
      if(!dist)continue;
      const nx=-dy/dist*radius,ny=dx/dist*radius;
      ctx.moveTo(a[0]+nx,a[1]+ny);ctx.lineTo(b[0]+nx,b[1]+ny);
      ctx.lineTo(b[0]-nx,b[1]-ny);ctx.lineTo(a[0]-nx,a[1]-ny);ctx.closePath();
      for(const p of [a,b]){ctx.moveTo(p[0]+radius,p[1]);ctx.arc(p[0],p[1],radius,0,Math.PI*2);}
    }
  }
  ctx.clip();
}

export function createPavingSurface({useCanvasAnimation=false,waterMaskCanvas=null}={}){
  const finalCanvas=document.createElement('canvas');finalCanvas.width=WIDTH;finalCanvas.height=HEIGHT;
  const finalCtx=finalCanvas.getContext('2d',{alpha:true});
  const beforeCanvas=document.createElement('canvas');beforeCanvas.width=WIDTH;beforeCanvas.height=HEIGHT;
  const beforeCtx=beforeCanvas.getContext('2d',{alpha:true});
  const progressCanvas=document.createElement('canvas');progressCanvas.width=WIDTH;progressCanvas.height=HEIGHT;
  const progressCtx=progressCanvas.getContext('2d',{alpha:false});
  const canvas=useCanvasAnimation?document.createElement('canvas'):finalCanvas;
  if(useCanvasAnimation){canvas.width=WIDTH;canvas.height=HEIGHT;}
  const ctx=useCanvasAnimation?canvas.getContext('2d',{alpha:true}):finalCtx;
  const mask=document.createElement('canvas');mask.width=WIDTH;mask.height=HEIGHT;
  const mctx=mask.getContext('2d',{alpha:true});
  const stoneCanvas=stonePattern();
  const pattern=mctx.createPattern(stoneCanvas,'repeat');
  if(pattern?.setTransform&&typeof DOMMatrix!=='undefined')
    pattern.setTransform(new DOMMatrix([PAVING_STONE_SIZE.patternScale,0,0,
      PAVING_STONE_SIZE.patternScale,0,0]));
  let currentPaths=[],oldPaths=[],newPaths=[],plazas=[],rivers=[],bridges=[];
  let start=0,paintedAt=0,progress=1,animating=false,mode='auto';
  let planKey=null;
  function repaint(target,paths,forecourts){
    target.clearRect(0,0,WIDTH,HEIGHT);
    const visible=paths.map(path=>({points:path.p,width:visibleWidth(path,mode)}));
    mctx.clearRect(0,0,WIDTH,HEIGHT);
    if(!visible.length&&!forecourts.length)return;
    // Merge contact shadow in a single mask so crossroads do not acquire
    // dark double shadows. The opaque curb passes then share the stone inset.
    stroke(mctx,visible,1.02,'#ffffff');
    fillForecourts(mctx,forecourts,1.02,'#ffffff');
    mctx.globalCompositeOperation='source-in';
    mctx.fillStyle='rgba(57,68,52,.22)';mctx.fillRect(0,0,WIDTH,HEIGHT);
    mctx.globalCompositeOperation='source-over';
    target.drawImage(mask,0,0);
    stroke(target,visible,.55,'#777b70');             // buried lower kerb
    fillForecourts(target,forecourts,.55,'#777b70');
    stroke(target,visible,.34,'#d6c6a9');             // warmer worn stone edge
    fillForecourts(target,forecourts,.34,'#d6c6a9');
    stroke(target,visible,.12,'#777b70');             // tight mortar seam
    fillForecourts(target,forecourts,.12,'#777b70');
    // Mask the WHOLE pedestrian network once; the same cobbles continue
    // through every bend and crossing, with no doubled interior seams.
    mctx.clearRect(0,0,WIDTH,HEIGHT);
    stroke(mctx,visible,0,'#ffffff');
    fillForecourts(mctx,forecourts,0,'#ffffff');
    mctx.globalCompositeOperation='source-in';
    // On WebGL the large atlas carries only the path mask and kerb wash.
    // Full-resolution cobbles are sampled separately in world space by the
    // paving shader, so tiny stones stay crisp even on the 2-km map.
    // A neutral mortar color underlies the GPU cobbles. The shader replaces
    // exactly this contribution using the separate antialiased coverage mask.
    // Even without WebGL detail, no raw white can escape between the stones.
    mctx.fillStyle=useCanvasAnimation?pattern:PAVING_BASE_COLOR;
    mctx.fillRect(0,0,WIDTH,HEIGHT);
    mctx.globalCompositeOperation='source-over';
    target.drawImage(mask,0,0);
    drawEdgeWear(target,visible);
    if(rivers.length){
      target.save();target.globalCompositeOperation='destination-out';
      target.lineCap='round';target.lineJoin='round';target.strokeStyle='#000';
      for(const river of rivers){
        if(river.points.length<2)continue;
        target.beginPath();target.moveTo(...texturePoint(river.points[0]));
        for(const point of river.points.slice(1))target.lineTo(...texturePoint(point));
        target.lineWidth=(river.width+.35)*PPM;target.stroke();
      }
      target.restore();
    }
    // The terrain's water and the road atlas use different meshes. Erase the
    // same water pixels from ALL paving layers, including their kerbs, so a
    // low-poly road triangle cannot bridge the river like a floating causeway.
    if(waterMaskCanvas?.width&&waterMaskCanvas?.height){
      target.save();target.globalCompositeOperation='destination-out';
      target.drawImage(waterMaskCanvas,0,0,WIDTH,HEIGHT);target.restore();
    }
    // Bridge decks supply their own continuous masonry paving. Suppress the
    // independent road mesh over their entire width, even on dry landfalls;
    // otherwise two differently tessellated surfaces intersect and flicker.
    if(bridges.length){
      target.save();target.globalCompositeOperation='destination-out';
      target.fillStyle='#000';
      for(const bridge of bridges){
        if(!(bridge.span>0&&bridge.deckWidth>0))continue;
        const [x,y]=texturePoint([bridge.x,bridge.z]);
        target.save();target.translate(x,y);
        target.rotate(Math.atan2(bridge.dirZ,bridge.dirX));
        // Keep a sliver of the approach path inside the stone entrance so it
        // joins the independent bridge paving without a disconnected seam.
        const {halfLength,halfWidth}=bridgePavingCutout(bridge);
        target.fillRect(-halfLength*PPM,-halfWidth*PPM,
          2*halfLength*PPM,2*halfWidth*PPM);
        target.restore();
      }
      target.restore();
    }
  }
  function preview(fraction){
    if(!useCanvasAnimation)return;
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    if(!animating){ctx.drawImage(finalCanvas,0,0);return;}
    ctx.drawImage(beforeCanvas,0,0);
    // Only blend two prepainted images while the roads emerge. The expensive
    // cobble pattern, shadow unions and borders are not rebuilt every frame.
    ctx.save();clipRevealedPaths(ctx,newPaths,fraction,mode);
    ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(finalCanvas,0,0);ctx.restore();
  }
  function setPaths(paths,{animate=true,forecourts=[],landscape=null,bridges:nextBridges=[]}={}){
    // Hash only what the painter reads. A new array or changed tree positions
    // must not force a full 2640×1800 canvas repaint and GPU texture upload.
    const nextKey=JSON.stringify([
      paths.map(path=>[path.p,path.width||0,path.pavingType||'walk']),
      forecourts.map(plaza=>[plaza.x,plaza.z,plaza.width,plaza.depth,plaza.rotation||0]),
      (landscape?.rivers||[]).map(river=>[river.width,river.points]),
      nextBridges.map(bridge=>[bridge.x,bridge.z,bridge.span,bridge.deckWidth,
        bridge.dirX,bridge.dirZ]),
    ]);
    if(nextKey===planKey&&(!animating||animate))
      return {finalChanged:false,beforeChanged:false,progressChanged:false};
    planKey=nextKey;
    const before=new Set(currentPaths.map(signature));
    oldPaths=animate?paths.filter(path=>before.has(signature(path))):paths;
    newPaths=animate?paths.filter(path=>!before.has(signature(path))):[];
    currentPaths=paths;plazas=forecourts;rivers=landscape?.rivers||[];bridges=nextBridges;
    start=performance.now();paintedAt=start;animating=Boolean(animate&&newPaths.length);
    progress=animating?.015:1;
    repaint(finalCtx,currentPaths,plazas);
    if(!useCanvasAnimation){
      if(animating)paintRevealProgress(progressCtx,newPaths,mode);
      else resetArrival(progressCtx);
      encodeInteriorCoverage(progressCtx,mctx,coverageBounds(currentPaths,plazas,mode));
    }
    if(animating){
      repaint(beforeCtx,oldPaths,plazas);
      if(useCanvasAnimation)paintRevealProgress(progressCtx,newPaths,mode);
    }
    preview(progress);
    return {finalChanged:true,beforeChanged:animating,progressChanged:true};
  }
  function refreshWaterMask(){
    repaint(finalCtx,currentPaths,plazas);
    if(animating)repaint(beforeCtx,oldPaths,plazas);
    preview(progress);
    return {beforeChanged:animating};
  }
  function update(now){
    if(!animating)return false;
    const t=Math.min(1,(now-start)/640);
    // WebGL changes a uniform per frame; fallback composites two cached
    // images at 24fps, never rasterizing the cobblestones again.
    if(useCanvasAnimation&&t<1&&now-paintedAt<42)return false;
    paintedAt=now;
    progress=1-(1-t)**3;
    if(t>=1){oldPaths=currentPaths;newPaths=[];animating=false;progress=1;}
    preview(progress);
    return true;
  }
  function setStyle(next){
    if(!MODES.includes(next)||next===mode)return false;
    mode=next;oldPaths=currentPaths;newPaths=[];animating=false;progress=1;
    repaint(finalCtx,currentPaths,plazas);
    if(!useCanvasAnimation){resetArrival(progressCtx);encodeInteriorCoverage(progressCtx,mctx,
      coverageBounds(currentPaths,plazas,mode));}
    preview(1);
    return true;
  }
  return {canvas,finalCanvas,beforeCanvas,progressCanvas,stoneCanvas,setPaths,setStyle,update,
    refreshWaterMask,
    getProgress:()=>progress,isAnimating:()=>animating,
    dispose(){
      for(const surface of [finalCanvas,beforeCanvas,progressCanvas,mask,stoneCanvas,
        ...(useCanvasAnimation?[canvas]:[])]){
        surface.width=0;surface.height=0;
      }
    }};
}
