import {MODEL_TYPES,referenceFootprint} from './model-types.js';
import {createPavingSurface} from './paving-art.js';
import {createGroundSurface} from './ground-art.js';
import {bridgeProfiles,LANDSCAPE_BOUNDS} from './landscape-model.js';

// Editable plan view for browsers where GPU/WebGL contexts are unavailable.
// It uses exactly the same pure routing engine and editor callbacks as 3D.
const W=LANDSCAPE_BOUNDS.width,D=LANDSCAPE_BOUNDS.depth;
const $=id=>document.getElementById(id);
const round=n=>Math.round(n*2)/2;

function description(placement){
  return {...placement,...referenceFootprint(placement.type,placement.config)};
}

export function createPathBuilderFallback(canvas,callbacks={}){
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Canvas 2D is unavailable');
  let paving=null;
  let buildings=[],layout={paths:[],anchors:[]},tool=null,toolConfig=null,landscapeTool=null,landscape={rivers:[],hills:[],bridges:[],trees:[]},selected=null,grid=false,pathsVisible=true;
  let dragging=null,panning=null,hover=null,zoom=1,pan={x:0,y:0},frameStart=0,frames=0,running=true,active=true,dirty=true,frameHandle=0;
  let landscapeDrag=null;
  const eventController=new AbortController();
  let bridgeProfilesCache=bridgeProfiles(landscape);
  const invalidate=()=>{dirty=true;};
  const paintedGround=createGroundSurface({onUpdate:({waterChanged})=>{
    if(waterChanged)paving?.refreshWaterMask();
    invalidate();
  }});
  paving=createPavingSurface({useCanvasAnimation:true,waterMaskCanvas:paintedGround.waterCanvas});
  let width=1,height=1,ratio=1;
  const scale=()=>Math.min(width/W,height/D)*.94*zoom;
  const project=(x,z)=>[width/2+pan.x+x*scale(),height/2+pan.y+z*scale()];
  const unproject=(x,y)=>({x:round((x-width/2-pan.x)/scale()),z:round((y-height/2-pan.y)/scale())});
  const mouse=e=>{const rect=canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
  const drawBackground=()=>{
    ctx.fillStyle='#d0d7c5';ctx.fillRect(0,0,width,height);
    const [x,y]=project(-W/2,-D/2),s=scale();
    ctx.drawImage(paintedGround.canvas,x,y,W*s,D*s);
    ctx.strokeStyle='rgba(83,113,91,.5)';ctx.lineWidth=1;ctx.strokeRect(x,y,W*s,D*s);
    if(grid){
      ctx.beginPath();for(let gx=-W/2+2;gx<=W/2-2;gx+=4){const [px]=project(gx,0);ctx.moveTo(px,y);ctx.lineTo(px,y+D*s);}
      for(let gz=-D/2+2;gz<=D/2-2;gz+=4){const [,py]=project(0,gz);ctx.moveTo(x,py);ctx.lineTo(x+W*s,py);}
      ctx.strokeStyle='rgba(67,94,73,.18)';ctx.lineWidth=.6;ctx.stroke();
    }
  };
  const drawPaths=()=>{
    if(!pathsVisible)return;
    const [x,y]=project(-W/2,-D/2),s=scale();
    ctx.drawImage(paving.canvas,x,y,W*s,D*s);
    if(!grid)return;
    for(const anchor of layout.anchors){
      const [x,y]=project(anchor.x,anchor.z);
      ctx.beginPath();ctx.arc(x,y,Math.max(2.5,scale()*.24),0,Math.PI*2);
      ctx.fillStyle='#fff0cb';ctx.fill();ctx.strokeStyle='#a48c60';ctx.lineWidth=1;ctx.stroke();
    }
  };
  const drawBridges=()=>{
    for(const bridge of bridgeProfilesCache){
      const [x,y]=project(bridge.x,bridge.z),s=scale();
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(bridge.dirZ,bridge.dirX));
      const w=bridge.span*s,d=bridge.deckWidth*s;
      ctx.fillStyle='#8b8c79';ctx.fillRect(-w/2-2,-d/2-2,w+4,d+4);
      ctx.fillStyle=bridge.fixed?'#d3c39f':'#bfb69e';ctx.fillRect(-w/2,-d/2,w,d);
      const rows=Math.max(8,Math.ceil(bridge.span/(bridge.fixed?2.5:.85))),cols=4;
      const stoneColors=['#dfd7bc','#c8c2ac','#aaa99e','#c7b9a1','#d5cbb4','#b9b5a6'];
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
        const cw=w/rows,ch=d/cols;
        const px=-w/2+i*cw+(j%2)*cw*.08,py=-d/2+j*ch;
        ctx.fillStyle=stoneColors[(i*7+j*3)%stoneColors.length];
        ctx.fillRect(px+1,py+1,Math.max(2,cw-2),Math.max(2,ch-2));
      }
      ctx.fillStyle='#a29e87';ctx.fillRect(-w/2,-d/2-3,w,4);ctx.fillRect(-w/2,d/2-1,w,4);
      ctx.fillStyle='#e4d6b9';ctx.fillRect(-w/2,-d/2-3,w,1.6);ctx.fillRect(-w/2,d/2+2,w,1.6);
      ctx.restore();
    }
  };
  const treeColors={
    oak:['#416e4b','#5f8f59','#8baa6e','#a9bc83'],
    linden:['#b8943b','#cfa749','#e4c86c','#f3dc8e'],
    maple:['#a74335','#c35440','#d87648','#e49d60'],
  };
  // Reusable hand-painted overhead crowns keep the non-WebGL editor readable
  // at all zoom levels without expensive per-frame brushstroke generation.
  const treeStamps=Object.fromEntries(Object.entries(treeColors).map(([kind,colors],index)=>{
    const stamp=document.createElement('canvas');stamp.width=stamp.height=144;
    const brush=stamp.getContext('2d');let seed=1357+index*1421;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    brush.fillStyle=colors[0];brush.beginPath();
    for(let i=0;i<=32;i++){
      const a=i*Math.PI*2/32,r=47+Math.sin(a*(kind==='maple'?7:5))*(kind==='maple'?9:5)+(rnd()-.5)*8;
      const x=72+Math.cos(a)*r,y=72+Math.sin(a)*r;
      if(i===0)brush.moveTo(x,y);else brush.lineTo(x,y);
    }
    brush.closePath();brush.fill();
    for(let i=0;i<115;i++){
      const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*46,x=72+Math.cos(a)*d,y=72+Math.sin(a)*d;
      brush.fillStyle=colors[Math.floor(rnd()*colors.length)];brush.globalAlpha=.17+rnd()*.48;
      brush.beginPath();brush.ellipse(x,y,2+rnd()*9,1.2+rnd()*5,a,0,Math.PI*2);brush.fill();
    }
    brush.globalAlpha=1;
    return [kind,stamp];
  }));
  const drawTree=(tree,ghost=false)=>{
    const stamp=treeStamps[tree.kind];if(!stamp)return;
    const [x,y]=project(tree.x,tree.z),r=Math.max(2.6,3.4*scale()*(tree.size||1));
    ctx.save();ctx.globalAlpha=ghost ? .68 : 1;
    ctx.fillStyle='rgba(55,68,47,.22)';ctx.beginPath();
    ctx.ellipse(x+r*.16,y+r*.27,r*.88,r*.72,-.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#88694f';ctx.fillRect(x-r*.12,y-r*.12,r*.24,r*.35);
    ctx.drawImage(stamp,x-r,y-r,r*2,r*2);
    ctx.restore();
  };
  const drawBuilding=(item,isGhost=false)=>{
    const def=MODEL_TYPES[item.type],spec=description(item),[x,y]=project(item.x,item.z),s=scale();
    ctx.save();ctx.translate(x,y);ctx.rotate(-(item.rotation||0));
    const w=spec.width*s,d=spec.depth*s;
    if(item.id===selected&&!isGhost){
      ctx.strokeStyle='#fff9e5';ctx.lineWidth=5;ctx.strokeRect(-w/2-3,-d/2-3,w+6,d+6);
    }
    const invalid=isGhost&&!(callbacks.isPlacementValid?.(spec)??true);
    ctx.fillStyle=isGhost?(invalid?'rgba(190,85,66,.57)':'rgba(230,218,169,.65)'):
      def.kind==='landmark'?'#b6ad91':'#c9b8a1';
    ctx.strokeStyle=isGhost?(invalid?'#9b3529':'#d8d8b5'):'#5f655a';
    ctx.lineWidth=Math.max(1.5,s*.15);
    ctx.fillRect(-w/2,-d/2,w,d);ctx.strokeRect(-w/2,-d/2,w,d);
    ctx.fillStyle=def.kind==='landmark'?'#667d78':
      item.type==='custom-house'?(item.config?.roofColor||'#ae745a'):
      item.type==='townhouse'?'#637d82':item.type==='workshop'?'#a58968':'#ae745a';
    const inset=Math.min(3.5,s*.6);
    ctx.fillRect(-w/2+inset,-d/2+inset,w-2*inset,d-2*inset);
    ctx.strokeStyle='rgba(237,223,195,.8)';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(0,-d/2+inset);ctx.lineTo(0,d/2-inset);ctx.stroke();
    if(def.kind==='landmark'){
      ctx.strokeStyle='#eee1c3';ctx.lineWidth=1.3;
      for(let i=-2;i<=2;i++){const px=i*w/7;ctx.beginPath();ctx.moveTo(px,d*.22);ctx.lineTo(px,d*.40);ctx.stroke();}
    }
    ctx.fillStyle='#e9d7aa';ctx.fillRect(-Math.max(3,w*.07),d/2-1,Math.max(6,w*.14),Math.max(3,s*.35));
    ctx.restore();
    if(!isGhost){
      ctx.font='600 10px Arial,sans-serif';ctx.fillStyle='#345046';ctx.textAlign='center';
      const label=MODEL_TYPES[item.type].label;
      ctx.fillText(label,x,y+Math.max(15,spec.depth*s*.5+14));
    }
  };
  function draw(){
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    drawBackground();drawPaths();drawBridges();
    for(const tree of landscape.trees||[])drawTree(tree);
    for(const item of buildings)drawBuilding(item);
    if(landscapeDrag?.points?.length){
      ctx.beginPath();const [x,y]=project(...landscapeDrag.points[0]);ctx.moveTo(x,y);
      for(const pt of landscapeDrag.points.slice(1))ctx.lineTo(...project(...pt));
      ctx.strokeStyle='#6fc3b8';ctx.lineWidth=Math.max(3,scale()*.7);
      ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    }
    if(tool&&hover)drawBuilding({...hover,id:'__ghost',type:tool,config:toolConfig,rotation:0},true);
    if(landscapeTool?.startsWith('tree-')&&hover)
      drawTree({kind:landscapeTool.slice(5),...hover,size:1},true);
  }
  const hitTest=point=>{
    for(const item of buildings.slice().reverse()){
      const b=description(item),dx=point.x-item.x,dz=point.z-item.z;
      const c=Math.cos(item.rotation||0),s=Math.sin(item.rotation||0);
      const x=c*dx-s*dz,z=s*dx+c*dz;
      if(Math.abs(x)<b.width/2&&Math.abs(z)<b.depth/2)return item.id;
    }
    return null;
  };
  function pointerDown(event){
    if(event.button===2){
      panning={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
      canvas.setPointerCapture(event.pointerId);event.preventDefault();return;
    }
    if(event.button!==0)return;
    const pos=mouse(event),at=unproject(pos.x,pos.y);
    if(landscapeTool){
      if(landscapeTool==='river'){
        landscapeDrag={points:[[at.x,at.z]],pointerId:event.pointerId};canvas.setPointerCapture(event.pointerId);
      }else callbacks.onLandscapeAction?.(landscapeTool,at);
      event.preventDefault();invalidate();return;
    }
    if(tool){callbacks.onPlace?.({...description({id:'__ghost',type:tool,config:toolConfig,x:at.x,z:at.z,rotation:0})});
      event.preventDefault();return;}
    const id=hitTest(at);callbacks.onSelect?.(id);
    if(!id)return;
    const item=buildings.find(b=>b.id===id);
    dragging={id,offsetX:item.x-at.x,offsetZ:item.z-at.z,moved:false,pointerId:event.pointerId};
    canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');event.preventDefault();
  }
  function pointerMove(event){
    if(panning){pan.x+=event.clientX-panning.x;pan.y+=event.clientY-panning.y;
      panning={...panning,x:event.clientX,y:event.clientY};invalidate();return;}
    const pos=mouse(event),at=unproject(pos.x,pos.y);
    if(landscapeDrag){
      const points=landscapeDrag.points,last=points.at(-1);
      if(Math.hypot(at.x-last[0],at.z-last[1])>=.8){points.push([at.x,at.z]);invalidate();}
      return;
    }
    if(dragging){
      const x=round(at.x+dragging.offsetX),z=round(at.z+dragging.offsetZ);
      dragging.moved=callbacks.onMove?.(dragging.id,x,z)||dragging.moved;
    }else if(tool||landscapeTool?.startsWith('tree-')){hover=at;invalidate();}
  }
  function pointerUp(event){
    if(event.type==='pointercancel'){cancelInteraction();return;}
    if(panning){panning=null;
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      invalidate();return;}
    if(landscapeDrag){
      const points=landscapeDrag.points;landscapeDrag=null;
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      callbacks.onLandscapeStroke?.(points);invalidate();return;
    }
    if(!dragging)return;
    const moved=dragging.moved;dragging=null;canvas.classList.remove('is-dragging');
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(moved)callbacks.onMoveEnd?.();
  }
  canvas.addEventListener('pointerdown',pointerDown,{signal:eventController.signal});
  canvas.addEventListener('pointermove',pointerMove,{signal:eventController.signal});
  canvas.addEventListener('pointerup',pointerUp,{signal:eventController.signal});
  canvas.addEventListener('pointercancel',pointerUp,{signal:eventController.signal});
  canvas.addEventListener('pointerleave',()=>{hover=null;invalidate();},{signal:eventController.signal});
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();const at=mouse(event),world=unproject(at.x,at.y);
    zoom=Math.max(.65,Math.min(14,zoom*(event.deltaY>0?.87:1.15)));
    pan.x=at.x-width/2-world.x*scale();pan.y=at.y-height/2-world.z*scale();invalidate();
  },{passive:false,signal:eventController.signal});
  canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal:eventController.signal});
  const resize=()=>{
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    invalidate();
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
  function frame(time){
    if(!running)return;
    frameHandle=requestAnimationFrame(frame);
    if(!active){frameStart=time;frames=0;return;}
    if(paving.update(time))invalidate();
    if(dirty){draw();dirty=false;}
    frames++;
    if(time-frameStart>1000){callbacks.onMetrics?.({fps:Math.round(frames*1000/(time-frameStart)),triangles:0});frames=0;frameStart=time;}
  }
  frameHandle=requestAnimationFrame(frame);
  function cancelInteraction(){
    const hadMove=Boolean(dragging?.moved);
    for(const id of [dragging?.pointerId,landscapeDrag?.pointerId,panning?.pointerId])
      if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    dragging=null;landscapeDrag=null;panning=null;
    canvas.classList.remove('is-dragging');invalidate();
    if(hadMove)callbacks.onMoveCancel?.();
  }
  return {
    syncBuildings(placements){buildings=placements.map(p=>({...p}));invalidate();return buildings.map(description);},
    describeExisting(id,placement){return buildings.some(b=>b.id===id)?description(placement):null;},
    previewMove(id,placement){const item=buildings.find(b=>b.id===id);
      if(item){item.x=placement.x;item.z=placement.z;invalidate();}},
    cancelInteraction,
    setSelected(id){selected=id;invalidate();},
    setTool(type,config=null){tool=type;toolConfig=config;hover=null;invalidate();canvas.classList.toggle('is-placing',Boolean(tool));},
    setLandscapeTool(mode){landscapeTool=mode;tool=null;hover=null;invalidate();canvas.classList.toggle('is-placing',Boolean(mode));},
    setLandscapePlan(next){landscape=next;bridgeProfilesCache=bridgeProfiles(next);invalidate();},
    setTrees(trees){landscape={...landscape,trees};invalidate();},
    setPathPlan(next,options){layout=next;paving.setPaths(layout.paths,{...options,
      landscape,bridges:bridgeProfilesCache,forecourts:layout.plazas});invalidate();},
    setGroundPlan(plots,plan,settings,pavingMode,nextLandscape){paintedGround.setPlan(plots,plan,settings,pavingMode,nextLandscape);invalidate();},
    setPavingStyle(mode){paving.setStyle(mode);invalidate();},
    setPathsVisible(visible){pathsVisible=visible;invalidate();},
    setGridVisible(visible){grid=visible;invalidate();},
    setView(view){zoom=view==='overview'?1:4;pan={x:0,y:0};invalidate();},
    setActive(value){active=Boolean(value);if(active)invalidate();},
    dispose(){running=false;cancelAnimationFrame(frameHandle);eventController.abort();
      observer.disconnect();paintedGround.dispose();paving.dispose();},mode:'canvas',
  };
}
