// Canvas2D isometric fallback for machines with no WebGL. It uses the same
// generated street plan and remains interactive (district, layout, view, picks).
export function createStreetFallback(canvas,{onMetrics=()=>{},onPick=()=>{}}={}) {
  const ctx=canvas.getContext('2d');
  let plan=null,night=false,view='three-quarter',selectable=[],selected=null;
  const color=(hex,factor=1)=>{
    const c=parseInt(hex.replace('#',''),16);
    return `rgb(${Math.min(255,((c>>16)&255)*factor)|0},${Math.min(255,((c>>8)&255)*factor)|0},${Math.min(255,(c&255)*factor)|0})`;
  };
  const corners=(x1,x2,z1,z2,y=0)=>[[x1,z1,y],[x2,z1,y],[x2,z2,y],[x1,z2,y]];
  const polygon=(points,fill,stroke,width=.6)=>{
    ctx.beginPath();points.forEach(([x,z,y],i)=>{const p=project(x,z,y);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);});ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  };
  let scale=5,cx=0,cy=0;
  const project=(x,z,y=0)=>view==='aerial'?
    [cx+x*scale,cy+z*scale*.92-y*scale*.15]:
    [cx+(x*.95+z*.37)*scale,cy+(z*.77-x*.22-y*.92)*scale];
  const stripPoints=(a,b,width,offset=0,y=.08)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
    const nx=-dz/len,nz=dx/len,half=width/2;
    return [[a[0]+nx*(offset+half),a[1]+nz*(offset+half),y],
      [b[0]+nx*(offset+half),b[1]+nz*(offset+half),y],
      [b[0]+nx*(offset-half),b[1]+nz*(offset-half),y],
      [a[0]+nx*(offset-half),a[1]+nz*(offset-half),y]];
  };
  // Mitered pavement follows the full crooked centreline with seamless bends.
  const ribbonPoints=(path,width,offset=0,y=.08)=>{
    const edge=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return [-dz/l,dx/l];};
    const sideAt=(i,d)=>{
      const before=edge(path[Math.max(0,i-1)],path[i]||path[0]);
      const after=edge(path[i],path[Math.min(path.length-1,i+1)]);
      const na=i===0?after:i===path.length-1?before:before;
      const nb=i===0?after:i===path.length-1?before:after;
      const sx=na[0]+nb[0],sz=na[1]+nb[1],norm=Math.hypot(sx,sz)||1;
      const mx=sx/norm,mz=sz/norm,denom=Math.max(.5,mx*nb[0]+mz*nb[1]);
      return [path[i][0]+mx*d/denom,path[i][1]+mz*d/denom,y];
    };
    return [...path.map((_,i)=>sideAt(i,offset+width/2)),
      ...path.map((_,i)=>sideAt(i,offset-width/2)).reverse()];
  };
  const trimAtJunctions=(line,junctions,maxWidth)=>{
    const path=line.path,distances=[0];
    for(let i=1;i<path.length;i++)distances[i]=distances[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);
    const points=[{distance:0,junction:false}];
    for(let i=1;i<path.length-1;i++)if(junctions.some(j=>Math.hypot(j.x-path[i][0],j.z-path[i][1])<.01))
      points.push({distance:distances[i],junction:true});
    points.push({distance:distances.at(-1),junction:false});
    const at=distance=>{
      for(let i=1;i<path.length;i++)if(distance<=distances[i]||i===path.length-1){
        const t=Math.max(0,Math.min(1,(distance-distances[i-1])/(distances[i]-distances[i-1])));
        return [path[i-1][0]+(path[i][0]-path[i-1][0])*t,path[i-1][1]+(path[i][1]-path[i-1][1])*t];
      }
      return path.at(-1);
    };
    return points.slice(1).map((end,i)=>{
      const start=points[i],cut=maxWidth/2+.4;
      const from=start.distance+(start.junction?cut:0),to=end.distance-(end.junction?cut:0);
      return to-from>1.4?[at(from),...path.filter((_,j)=>distances[j]>from&&distances[j]<to),at(to)]:[];
    }).filter(part=>part.length>=2);
  };
  function drawQuarterGround(){
    polygon(corners(-92,91,-80,76,-.16),night?'#565a54':'#d5c6a8');
    for(const line of plan.roads.lines){
      polygon(ribbonPoints(line.path,line.width,0,.035),night?'#6d6c65':line.surface==='paving'?'#b9ad94':'#908778');
    }
    for(const line of plan.roads.lines){
      const cut=Math.max(...plan.roads.lines.map(other=>other.width));
      for(const part of trimAtJunctions(line,plan.roads.junctions,cut))for(const side of [-1,1]){
        polygon(ribbonPoints(part,line.walkWidth,side*(line.width/2+line.walkWidth/2),.12),
          night?'#85837a':'#c9b99b','#ab9a80',.6);
      }
    }
    for(const walk of plan.walkways)for(let i=1;i<walk.p.length;i++)
      polygon(stripPoints(walk.p[i-1],walk.p[i],walk.width,0,.17),night?'#aea494':'#d5c6a9');
    const yard=plan.courtyard;
    polygon(yard.polygon.map(([x,z])=>[x,z,.14]),night?'#9f9b84':'#c4b69b','#e1ccad',1.3);
    polygon(corners(16.2,18,6.4,9.5,.2),night?'#55704c':'#839769');
    polygon(corners(24.7,26.5,6.4,9.5,.2),night?'#55704c':'#839769');
    // The paved route crosses the irregular courtyard and remains visible.
    for(const walk of plan.walkways.filter(walk=>walk.kind==='courtyard'))
      for(let i=1;i<walk.p.length;i++)polygon(stripPoints(walk.p[i-1],walk.p[i],walk.width,0,.18),night?'#c3b8a4':'#e2d3b8');
    const [tx,ty]=project(21.2,8.6,3.1);
    ctx.fillStyle=night?'#425c42':'#657e56';ctx.beginPath();ctx.arc(tx,ty,9,0,Math.PI*2);ctx.fill();
  }
  function drawHouse(house){
    const {config:c,x,z,rotation=0}=house;
    const h=c.floors*2.85+0.5,roofH=c.roofType==='flat'?.3:c.roofHeight;
    const sn=Math.sin(rotation),cs=Math.cos(rotation),width=c.width,depth=c.depth;
    const point=(u,v,y=0)=>[x+u*cs+v*sn,z-u*sn+v*cs,y];
    const wall=color(c.plasterColor,night?.5:1);
    const endWall=color(c.plasterColor,night?.38:.81);
    const roof=color(c.roofColor,night?.56:1);
    const roofShade=color(c.roofColor,night?.42:.77);
    polygon([point(-width/2,-depth/2),point(width/2,-depth/2),point(width/2,-depth/2,h),point(-width/2,-depth/2,h)],endWall,'#594d4030');
    polygon([point(-width/2,-depth/2),point(-width/2,depth/2),point(-width/2,depth/2,h),point(-width/2,-depth/2,h)],endWall,'#594d4030');
    polygon([point(-width/2,depth/2),point(width/2,depth/2),point(width/2,depth/2,h),point(-width/2,depth/2,h)],wall,'#584b3c50');
    for(let floor=0;floor<c.floors;floor++){
      const bottom=.48+floor*2.85;
      const n=c.frontWindows;
      for(let i=0;i<n;i++){
        const along=-width/2+(i+1)*width/(n+1);
        const points=[point(along-.29,depth/2+.02,bottom+.65),point(along+.29,depth/2+.02,bottom+.65),
          point(along+.29,depth/2+.02,bottom+1.7),point(along-.29,depth/2+.02,bottom+1.7)];
        polygon(points,night?'#ebc681':'#689aa1',c.woodColor,1.2);
      }
    }
    if(c.roofType==='flat')polygon([point(-width/2-.22,-depth/2-.25,h+.28),point(width/2+.22,-depth/2-.25,h+.28),
      point(width/2+.22,depth/2+.25,h+.28),point(-width/2-.22,depth/2+.25,h+.28)],roof,'#5c4935',.9);
    else {
      polygon([point(-width/2-.3,-depth/2-.3,h),point(0,-depth/2-.3,h+roofH),
        point(0,depth/2+.3,h+roofH),point(-width/2-.3,depth/2+.3,h)],roofShade,'#654d3d',.8);
      polygon([point(0,-depth/2-.3,h+roofH),point(width/2+.3,-depth/2-.3,h),
        point(width/2+.3,depth/2+.3,h),point(0,depth/2+.3,h+roofH)],roof,'#614c3c',.85);
    }
    if(c.chimney){
      const chimney=point(-width*.18,-depth*.17,h+roofH+.48);
      polygon(corners(chimney[0]-.3,chimney[0]+.3,chimney[1]-.28,chimney[1]+.28,chimney[2]),
        color('#b59b83',night?.48:1),'#7b6250');
    }
    const roofPoints=[point(-width/2,-depth/2,h+roofH),point(width/2,-depth/2,h+roofH),
      point(width/2,depth/2,h+roofH),point(-width/2,depth/2,h+roofH)].map(([xx,zz,yy])=>project(xx,zz,yy));
    selectable.push({record:house,points:roofPoints});
    if(selected?.id===house.id){ctx.strokeStyle='#f3d487';ctx.lineWidth=3;ctx.beginPath();roofPoints.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.stroke();}
  }
  function drawLamp(lamp){
    const [sx,sy]=project(lamp.x,lamp.z,.25);
    const [tx,ty]=project(lamp.x,lamp.z,5.7);
    ctx.strokeStyle=night?'#91846d':'#55524b';ctx.lineWidth=2.1;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(tx,ty);ctx.stroke();
    ctx.fillStyle=night?'#ffd58b':'#f6e6b5';ctx.shadowColor='#ffc671';ctx.shadowBlur=night?20:3;
    ctx.beginPath();ctx.arc(tx,ty,4.4,0,2*Math.PI);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='#74614c';ctx.strokeRect(tx-5.2,ty-7,10.4,12.4);
  }
  function draw(){
    if(!ctx||!plan)return;
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),w=rect.width,hh=rect.height;
    canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(hh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    scale=plan.mode==='quarter'?Math.min(w/175,hh/145):Math.min(w/72,hh/(plan.road.length*1.06));
    cx=w*.50;cy=hh*.54;
    ctx.fillStyle=night?'#283a4a':'#e9e2ce';ctx.fillRect(0,0,w,hh);
    ctx.fillStyle=night?'#364956':'#e0d6b9';
    for(let x=-130;x<130;x+=6)for(let z=-130;z<130;z+=6){const [sx,sy]=project(x,z);ctx.fillRect(sx,sy,.7,.7);}
    if(plan.mode==='quarter')drawQuarterGround();
    else {
      const r=plan.road.width,l=plan.road.length,s=plan.sidewalks.width;
      polygon(corners(-r/2,r/2,-l/2,l/2,.01),night?'#545858':'#898274','#786f6044');
      for(const side of [-1,1]) {
        const edge=side*r/2;
        polygon(corners(Math.min(edge,edge+side*s),Math.max(edge,edge+side*s),-l/2,l/2,.19),night?'#85837d':'#cfc0a2','#998771');
        for(let z=-l/2;z<l/2;z+=1.3){const [x1,y1]=project(edge,z,.21),[x2,y2]=project(edge+side*s,z,.21);ctx.strokeStyle='#7e735a36';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
      }
      if(plan.profile.surface==='cobble')for(let z=-l/2;z<l/2;z+=.95)for(let x=-r/2+.4;x<r/2-.2;x+=1.25){polygon(corners(x,x+.83,z,z+.57,.05),night?'#636360':'#968c78','#6c625528',.4);}
    }
    // Period street: stone paving only, with no modern lane or crosswalk paint.
    selectable=[];
    // Paint distant and nearer facades in order of projected depth.
    plan.houses.slice().sort((a,b)=>(a.z*.77-a.x*.22)-(b.z*.77-b.x*.22)).forEach(drawHouse);
    plan.lamps.slice().sort((a,b)=>a.z-b.z).forEach(drawLamp);
    onMetrics({fps:'2D',triangles:'—',lod:'2D',houses:plan.houses.length,lamps:plan.lamps.length});
  }
  const inside=(px,py,points)=>{
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [xi,yi]=points[i],[xj,yj]=points[j];
      if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
    }return inside;
  };
  function onClick(e){const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;const picked=selectable.slice().reverse().find(item=>inside(x,y,item.points));if(picked){selected=picked.record;onPick(selected);draw();}}
  canvas.addEventListener('click',onClick);
  const observer=new ResizeObserver(draw);observer.observe(canvas);
  return {
    setPlan(p){plan=p;selected=null;draw();},
    setNight(on){night=Boolean(on);draw();},
    setView(next){view=next==='aerial'?'aerial':'three-quarter';draw();},
    dispose(){observer.disconnect();canvas.removeEventListener('click',onClick);},
    isFallback:true,
  };
}
