// Street grid, reserved building lots, bridges, and river channel surfaces.
export function createCityRoads(ctx) {
  const {T,materials,coast,riverPoints,riverWidth,headwaterFade,heightAt,terrainSurfaceAt,local,part,ribbon,collectSurface,stairRuns,clamp,ROOT_COORDINATES,northTerrainEdge}=ctx;
  let riverSurfaceHeight=null;
  // Streets use a rectilinear town grid. The old meandering centerlines
  // produced diagonal paver wedges, especially at the bridge approaches.
  // Only the coastal walkways follow the actual curved shoreline.
  const mainRoads=[
    {w:3.1,p:[[5,coast(5)-1.65],[5,-101]]},
    {w:2.1,p:[[-119,9.07],[119,9.07]]},
    {w:2.0,p:[[-119,-12.1],[119,-12.1]]},
    {w:2.3,p:[[-119,-28.7],[119,-28.7]]},
    // The eastern-bank road runs straight uphill from the bridge landing.
    // The former dogleg made a large, triangular paved spur on the castle hill.
    {w:1.7,p:[[-26,-28.7],[-26,-101]]},
    {w:1.7,p:[[35,coast(35)-1.65],[35,-101]]},
  ];
  const westPromenade={w:2.15,p:[]},eastPromenade={w:2.15,p:[]};
  for(let x=-120;x<=120;x+=3){
    if(x<=-27)westPromenade.p.push([x,coast(x)-1.65]);
    if(x>=-12)eastPromenade.p.push([x,coast(x)-1.65]);
  }
  // Both quay walks stop on dry ground. The estuary remains open to the sea.
  mainRoads.push(westPromenade,eastPromenade);
  // No diagonal shortcuts: right-angle junctions preserve the stone courses.
  const minorRoads=[
    {w:1.35,p:[[-86,coast(-86)-1.65],[-86,-101]]},
    {w:1.3,p:[[-13,coast(-13)-1.65],[-13,-28.7]]},
    {w:1.35,p:[[16,coast(16)-1.65],[16,-28.7]]},
    {w:1.35,p:[[50,coast(50)-1.65],[50,-62],[35,-62]]},
    {w:1.2,p:[[-52,-12.1],[-52,-3],[-43,-3]]},
    {w:1.25,p:[[16,-5],[50,-5]]},
    {w:1.25,p:[[16,-22],[50,-22]]},
    {w:1.5,p:[[-60,9.07],[-60,coast(-60)-1.65]]},
    {w:1.5,p:[[-13,9.07],[-13,14],[50,14]]},
    // Two factory-housing loops remain on the western bank.
    {w:1.5,p:[[-86,-28.7],[-86,-49],[-68,-49],[-68,-45],[-86,-45]]},
    {w:1.25,p:[[-86,-60],[-78,-60],[-78,-78],[-86,-78]]},
    // Keep the new hill frontage clear of the obsolete eastern service loop.
    {w:1.55,p:[[-43,coast(-43)-1.65],[-43,-28.7]]},
  ];
  // Three inland crossings link the districts. The former fourth bridge
  // obstructed the river mouth, and has been removed entirely.
  const bridges=[[-35.8,-28.7,15,2.8,3],[-24,-12.1,14,2.65,2],
    [-22.5,9.07,14,2.65,1]];
  // Keep the entire works and their workers' settlement on the western bank.
  const factorySites=[[-95,-40,11,6,4.4],[-104,-22,8,6,3.4],[-91,-22,7,6,3.2]];
  const fieldPlots=[[66,-63,16,12,'grain'],[88,-65,18,14,'crops'],
    [68,-82,16,10,'crops'],[95,-83,18,11,'grain'],
    [65,-45,14,9,'grain'],[84,-45,14,9,'crops'],[105,-45,14,9,'grain'],
    [108,-65,12,11,'crops'],[111,-83,10,9,'grain']];
  const pierLayouts=[
    {x:-39,length:11.1,width:3.2,kind:'cargo'},
    {x:-12,length:8.1,width:2.15,kind:'fishing'},
    {x:29,length:13.4,width:3.3,kind:'cargo'},
    {x:48,length:7.9,width:2.0,kind:'fishing'},
  ];
  const farmAccess=[[35,-82],[52,-82],[52,-74],[119,-74]];
  const upperFarmAccess=[[52,-54],[119,-54]];
  function atPolyline(x,z,points) {
    let best=Infinity;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
      best=Math.min(best,Math.hypot(x-(a[0]+dx*t),z-(a[1]+dz*t)));
    }
    return best;
  }
  const reserved=[
    ...factorySites.map(([x,z,w,d])=>[x,z,Math.max(w,d)*.72]),
    [93,-33,5.8],
    // Each characterful neighborhood gets a legible civic landmark and space
    // around it; random houses must never swallow these focal points.
    [-42,-2,8.2],[43,-40,6.3],[-35,-6,7.8],[42,-32,7.8],
    [30,0,7],[23,0,2.4],[41,0,2.4],[5,-57,20],[-1,-4,5],[24,-24,6],[-12,15,5],[45,15,6],
    [-34,16,6.5],[18,15,6.5],
    ...fieldPlots.map(([x,z,w,d])=>[x,z,Math.max(w,d)*.73]),
  ];
  function isBuildable(x,z,clearance=2) {
    if(x<ROOT_COORDINATES.minX+1||x>ROOT_COORDINATES.maxX-1||z<ROOT_COORDINATES.minZ+1||z>coast(x)-1.2)return false;
    if(atPolyline(x,z,riverPoints)<5.15+clearance*.3)return false;
    if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+clearance))return false;
    if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+clearance))return false;
    if(bridgeProfiles.some(bridge=>{
      const dx=x-bridge.x,dz=z-bridge.z;
      const along=dx*Math.cos(bridge.heading)-dz*Math.sin(bridge.heading);
      const across=dx*Math.sin(bridge.heading)+dz*Math.cos(bridge.heading);
      return Math.abs(along)<bridge.length/2+1.4&&Math.abs(across)<bridge.width/2+.85;
    }))return false;
    if(reserved.some(([rx,rz,r])=>Math.hypot(x-rx,z-rz)<r+clearance*.25))return false;
    return true;
  }
  const smoothstep=(a,b,value)=>{
    const t=clamp((value-a)/(b-a),0,1);
    return t*t*(3-2*t);
  };
  const bridgeProfiles=bridges.map(([x,z,length,width,roadIndex])=>{
    const points=mainRoads[roadIndex].p;
    let distance=Infinity,heading=0;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
      const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
      if(d<distance){distance=d;heading=-Math.atan2(dz,dx);}
    }
    const left=local(x,z,-length/2,0,heading),right=local(x,z,length/2,0,heading);
    const deckY=Math.max(heightAt(...left),heightAt(...right),heightAt(x,z))+.20;
    return {x,z,length,width,roadIndex,heading,deckY,
      approach:roadIndex===2?10:roadIndex===3?9:roadIndex===1?7.5:6.5};
  });
  // Each road is one continuous mesh across its bridge and both eased slopes.
  // Nearby junctions also climb gently to meet the raised deck at equal height.
  function pavedRoadHeight(x,z,offset) {
    const ground=terrainSurfaceAt(x,z)+offset;
    let height=ground;
    for(const bridge of bridgeProfiles) {
      const dx=x-bridge.x,dz=z-bridge.z;
      const along=dx*Math.cos(bridge.heading)-dz*Math.sin(bridge.heading);
      const across=dx*Math.sin(bridge.heading)+dz*Math.cos(bridge.heading);
      const run=1-smoothstep(bridge.length/2,bridge.length/2+bridge.approach,Math.abs(along));
      if(run<=0)continue;
      const side=1-smoothstep(bridge.width/2+.25,bridge.width/2+5.5,Math.abs(across));
      if(side<=0)continue;
      const deckSurface=bridge.deckY+offset-.052;
      height=Math.max(height,ground+(deckSurface-ground)*run*side);
    }
    return height;
  }
  function roadStairs(points,width,offset) {
    const treadPositions=[],treadUvs=[],treadIndices=[];
    const riserPositions=[],riserUvs=[],riserIndices=[];
    const putQuad=(positions,uvs,indices,corners)=>{
      const start=positions.length/3;
      for(const [x,y,z] of corners){positions.push(x,y,z);uvs.push(x/2.35,z/5.2);}
      indices.push(start,start+2,start+1,start+1,start+2,start+3);
    };
    for(let segment=1;segment<points.length;segment++){
      const [ax,az]=points[segment-1],[bx,bz]=points[segment];
      const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
      if(length<2)continue;
      const alongX=dx/length,alongZ=dz/length,nx=-alongZ,nz=alongX;
      // Frequent, shallow treads remain legible from the isometric camera.
      const stepCount=Math.ceil(length/.265),stride=length/stepCount;
      const sites=Array.from({length:stepCount+1},(_,i)=>{
        const t=i/stepCount,x=ax+dx*t,z=az+dz*t;
        return {x,z,height:pavedRoadHeight(x,z,offset)};
      });
      let previousTop=null,previousActive=false;
      for(let i=0;i<stepCount;i++){
        const a=sites[i],b=sites[i+1],before=sites[Math.max(0,i-2)],after=sites[Math.min(stepCount,i+3)];
        const span=Math.min(stepCount,i+3)-Math.max(0,i-2);
        const grade=Math.abs(after.height-before.height)/Math.max(stride,span*stride);
        const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
        const approachingBridge=bridgeProfiles.some(bridge=>
          Math.hypot(x-bridge.x,z-bridge.z)<bridge.length/2+bridge.approach+3);
        // A dedicated, hand-built stairway finishes the final castle approach.
        // Avoid overlaying a second set of road risers on its stone steps.
        const castleApproach=Math.abs(x-5)<3.4&&z>=-37.8&&z<=-48.1;
        const active=grade>.27&&!approachingBridge&&!castleApproach;
        if(!active){previousTop=null;previousActive=false;continue;}
        const half=width/2;
        const crossSection=(site,side)=>[site.x+nx*half*side,site.z+nz*half*side];
        const al=crossSection(a,1),ar=crossSection(a,-1),bl=crossSection(b,1),br=crossSection(b,-1);
        const top=Math.max(...[al,ar,bl,br].map(([px,pz])=>pavedRoadHeight(px,pz,offset)))+.075;
        putQuad(treadPositions,treadUvs,treadIndices,[
          [al[0],top,al[1]],[ar[0],top,ar[1]],
          [bl[0],top,bl[1]],[br[0],top,br[1]],
        ]);
        if(previousActive&&Math.abs(top-previousTop)>.045){
          const lo=Math.min(top,previousTop),hi=Math.max(top,previousTop);
          putQuad(riserPositions,riserUvs,riserIndices,[
            [al[0],lo,al[1]],[ar[0],lo,ar[1]],
            [al[0],hi,al[1]],[ar[0],hi,ar[1]],
          ]);
        }
        stairRuns.push({x,z,top,width,grade});
        previousTop=top;previousActive=true;
      }
    }
    for(const [positions,uvs,indices,material] of [
      [treadPositions,treadUvs,treadIndices,'paving'],
      [riserPositions,riserUvs,riserIndices,'stonePath'],
    ]){
      if(!indices.length)continue;
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
      geo.setIndex(indices);geo.computeVertexNormals();
      const pavement=materials.get(material);
      if(material==='stonePath')pavement.side=T.DoubleSide;
      collectSurface(geo,pavement);
    }
  }
  function infrastructure(waterMats) {
    for(let i=0;i<mainRoads.length;i++) {
      const road=mainRoads[i];
      // A single stone surface is shared at all junctions. The dark underlay
      // used to show through as crossed stripes at every intersection.
      const roadLevel=.052+i*.00042;
      ribbon(road.p,road.w,i>=6?'paving':'road',roadLevel,{
        elevation:(x,z)=>pavedRoadHeight(x,z,roadLevel)});
      if(i<6)roadStairs(road.p,road.w,roadLevel);
    }
    // A long watercourse threads several neighborhoods together. No walls partition the districts.
    for(let i=0;i<minorRoads.length;i++){
      const road=minorRoads[i];
      const roadLevel=.058+i*.00038;
      ribbon(road.p,road.w,'road',roadLevel,{
        elevation:(x,z)=>pavedRoadHeight(x,z,roadLevel)});
      roadStairs(road.p,road.w,roadLevel);
    }
    // The river surface follows its carved channel, not the higher banks. A
    // nearest-centerline level makes water remain level across its width.
    // At its mouth the river gradually sinks into the open sea.
    const mouthBlend=(x,z)=>{
      const t=clamp((z-(coast(x)-7))/16,0,1);
      return t*t*(3-2*t);
    };
    riverSurfaceHeight=(x,z)=>{
      let closest=Infinity,centerX=x,centerZ=z;
      for(let i=1;i<riverPoints.length;i++){
        const [ax,az]=riverPoints[i-1],[bx,bz]=riverPoints[i];
        const dx=bx-ax,dz=bz-az;
        const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
        const px=ax+dx*t,pz=az+dz*t,distance=(x-px)**2+(z-pz)**2;
        if(distance<closest){closest=distance;centerX=px;centerZ=pz;}
      }
      const mouth=mouthBlend(centerX,centerZ);
      return (heightAt(centerX,centerZ)+.14)*(1-mouth)-.34*mouth;
    };
    const clipRiverAtMouth=coastOffset=>{
      const clipped=[riverPoints[0]];
      for(let i=1;i<riverPoints.length;i++){
        const [ax,az]=riverPoints[i-1],[bx,bz]=riverPoints[i];
        const inside=t=>{
          const x=ax+(bx-ax)*t,z=az+(bz-az)*t;
          return z<=coast(x)+coastOffset;
        };
        if(inside(1)){clipped.push(riverPoints[i]);continue;}
        let left=0,right=1;
        for(let j=0;j<17;j++){
          const mid=(left+right)/2;
          if(inside(mid))left=mid;else right=mid;
        }
        clipped.push([ax+(bx-ax)*left,az+(bz-az)*left]);
        break;
      }
      return clipped;
    };
    const clipRiverAtHead=points=>{
      let start=1;
      const inside=([x,z])=>z>=northTerrainEdge(x)+.6;
      while(start<points.length&&!inside(points[start]))start++;
      if(start===points.length)return [];
      const [ax,az]=points[start-1],[bx,bz]=points[start];
      let low=0,high=1;
      for(let i=0;i<17;i++){
        const mid=(low+high)/2;
        if(inside([ax+(bx-ax)*mid,az+(bz-az)*mid]))high=mid;
        else low=mid;
      }
      return [[ax+(bx-ax)*high,az+(bz-az)*high],...points.slice(start)];
    };
    // A continuous, slightly varying channel creates soft bends. The wider
    // sandy bed is visible through the water and fades into the sea. Straight
    // black retaining strips and floating paved bank ribbons have been removed.
    const riverBedPoints=clipRiverAtHead(clipRiverAtMouth(-3.4));
    const riverWaterPoints=clipRiverAtHead(clipRiverAtMouth(1.1));
    ribbon(riverBedPoints,10,'wetSand',.067,{rough:.006,crossSections:6,
      widthAt:(x,z)=>(riverWidth(x,z)+1.7+.46*Math.sin(z*.13-x*.055))*headwaterFade(x,z),
      centerOffsetAt:(x,z)=>.25*Math.sin(z*.14+x*.08),
      elevation:(x,z)=>Math.min(terrainSurfaceAt(x,z)+.08,riverSurfaceHeight(x,z)-.1)});
    ribbon(riverWaterPoints,7.65,waterMats.river,.086,{rough:0,crossSections:8,
      widthAt:riverWidth,elevation:riverSurfaceHeight});
    for(const bridge of bridgeProfiles) {
      const {x,z,length,width,heading,deckY,roadIndex}=bridge;
      const roadWidth=mainRoads[roadIndex].w;
      // Stone slab sits immediately below the uninterrupted paved road ribbon.
      part('stone','box',x,0,z,length,.28,width+.23,heading,0,0,deckY-.15);
      for(const side of [-1,1]){
        const [cx,cz]=local(x,z,0,side*(roadWidth/2+.19),heading);
        part('quay','box',cx,0,cz,length+.16,.30,.22,heading,0,0,deckY+.09);
        for(let dx=-length/2+.8;dx<length/2-.4;dx+=2.45){
          const [px,pz]=local(x,z,dx,side*(roadWidth/2+.19),heading);
          part('pale','box',px,0,pz,.18,.48,.21,heading,0,0,deckY+.38);
        }
      }
      for(const dx of [-length/2+1.4,length/2-1.4]){
        const [px,pz]=local(x,z,dx,0,heading);
        const base=heightAt(px,pz),support=Math.max(.28,deckY-base-.16);
        part('stone','box',px,support/2,pz,.85,support,width+.25,heading,0,0,base);
      }
    }
  }
  return {mainRoads,minorRoads,bridges,factorySites,fieldPlots,pierLayouts,farmAccess,upperFarmAccess,reserved,atPolyline,isBuildable,bridgeProfiles,pavedRoadHeight,roadStairs,infrastructure,get riverSurfaceHeight(){return riverSurfaceHeight;}};
}
