/** Connect all city entrances to the same paved pedestrian network. */
export function connectHousePaths({
  mainRoads,minorRoads,houseEntrances,occupiedLots,riverPoints,
  atPolyline,clamp,coast,ROOT_COORDINATES,housePaths,
  landmarkEntrances=[],publicEntrances=[],obstacles=[],landmarkPaths=[],publicPaths=[],
  ribbon,pavedRoadHeight,roadStairs,
}) {
  const streets=[...mainRoads,...minorRoads];
  const drawnPaths=[],routedPaths=[],paths=[],anchors=[];
  const allObstacles=[...occupiedLots,...obstacles];
  const streetSegments=streets.flatMap(road=>road.p.slice(1).map((b,i)=>[road.p[i],b]));
  const axial=(a,b)=>Math.abs(a[0]-b[0])<.0001||Math.abs(a[1]-b[1])<.0001;
  const freeSegment=(a,b,entrance)=>{
    if(entrance&&Math.hypot(a[0]-entrance.x,a[1]-entrance.z)<.005&&
       (b[0]-a[0])*entrance.forward[0]+(b[1]-a[1])*entrance.forward[1]<-.025)return false;
    const steps=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.65));
    for(let i=1;i<=steps;i++) {
      const t=i/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      if(atPolyline(x,z,riverPoints)<4.55)return false;
      if(allObstacles.some(lot=>lot!==entrance.lot&&Math.abs(x-lot.x)<lot.halfX+.27&&Math.abs(z-lot.z)<lot.halfZ+.27))return false;
    }
    return true;
  };
  const orthogonalConnections=(a,b,entrance)=>{
    const pivots=axial(a,b)?[null]:[[b[0],a[1]],[a[0],b[1]]];
    return pivots.map(pivot=>pivot?[a,pivot,b]:[a,b])
      .filter(points=>points.every((point,i)=>i===0||freeSegment(points[i-1],point,entrance)));
  };
  const routeLength=points=>points.slice(1).reduce((total,p,i)=>
    total+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
  const pathConflicts=(points,joining=false)=>{
    let count=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],steps=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.6));
      for(let j=1;j<steps;j++) {
        if(joining&&i===points.length-1&&j/steps>.78)continue;
        const t=j/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        if(streets.some(road=>atPolyline(x,z,road.p)<road.w/2+.2))continue;
        if(drawnPaths.some(path=>atPolyline(x,z,path)<.59))count++;
      }
    }
    return count;
  };
  const nearestOnSegment=(p,a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz),0,1);
    return [a[0]+dx*t,a[1]+dz*t];
  };
  const nearestStreet=p=>{
    let distance=Infinity,point=null;
    for(const [a,b] of streetSegments){
      const candidate=nearestOnSegment(p,a,b);
      const d=Math.hypot(p[0]-candidate[0],p[1]-candidate[1]);
      if(d<distance){distance=d;point=candidate;}
    }
    return {point,distance};
  };
  // Dense infill needs a walkable four-direction grid. Eight-neighbor moves
  // previously reintroduced crooked diagonal paving after simplification.
  const detourToStreet=(entrance,start)=>{
    const stride=.94,maxCells=47,limit=4200;
    const open=[],visited=new Map();
    const key=(i,j)=>`${i},${j}`;
    const position=(i,j)=>[start[0]+i*stride,start[1]+j*stride];
    const push=node=>{
      open.push(node);
      for(let k=open.length-1;k>0;){
        const parent=(k-1)>>1;
        if(open[parent].f<=open[k].f)break;
        [open[parent],open[k]]=[open[k],open[parent]];k=parent;
      }
    };
    const pop=()=>{
      const first=open[0],last=open.pop();
      if(open.length){
        open[0]=last;
        for(let k=0;k<open.length;){
          let child=k*2+1;
          if(child>=open.length)break;
          if(child+1<open.length&&open[child+1].f<open[child].f)child++;
          if(open[k].f<=open[child].f)break;
          [open[k],open[child]]=[open[child],open[k]];k=child;
        }
      }
      return first;
    };
    const goal=nearestStreet(start);
    push({i:0,j:0,g:0,f:goal.distance,prev:null});
    visited.set(key(0,0),0);
    let explored=0;
    while(open.length&&explored++<limit){
      const node=pop(),at=position(node.i,node.j);
      if(node.g>visited.get(key(node.i,node.j))+.001)continue;
      const street=nearestStreet(at);
      const finishing=street.distance<1.5?
        orthogonalConnections(at,street.point,entrance)[0]:null;
      if(finishing){
        const path=[];
        for(let tail=node;tail;tail=tail.prev)path.push(position(tail.i,tail.j));
        path.reverse();path.push(...finishing.slice(1));
        const result=[path[0]];
        for(let k=1;k<path.length;){
          let reach=k;
          for(let j=path.length-1;j>k;j--){
            if(axial(result[result.length-1],path[j])&&
              freeSegment(result[result.length-1],path[j],entrance)){
              reach=j;break;
            }
          }
          result.push(path[reach]);k=reach+1;
        }
        return result;
      }
      for(const [di,dj] of [[0,1],[1,0],[0,-1],[-1,0]]){
        const ni=node.i+di,nj=node.j+dj;
        if(Math.abs(ni)>maxCells||Math.abs(nj)>maxCells)continue;
        const next=position(ni,nj);
        if(next[0]<ROOT_COORDINATES.minX-4||next[0]>ROOT_COORDINATES.maxX+6||
          next[1]<ROOT_COORDINATES.minZ-4||next[1]>coast(next[0])-1.8)continue;
        if(node.i===0&&node.j===0&&
           di*entrance.forward[0]+dj*entrance.forward[1]<-.05)continue;
        if(!freeSegment(at,next,entrance))continue;
        const crossing=Math.hypot(di,dj)*stride;
        const overlap=drawnPaths.some(path=>atPolyline(next[0],next[1],path)<.5)?1.5:0;
        const cost=node.g+crossing+overlap;
        const k=key(ni,nj);
        if(cost>=(visited.get(k)??Infinity))continue;
        visited.set(k,cost);
        push({i:ni,j:nj,g:cost,f:cost+nearestStreet(next).distance,prev:node});
      }
    }
    return null;
  };
  const entrances=[...houseEntrances.map((entry,index)=>({id:`house-${index}`,kind:'house',...entry})),
    ...landmarkEntrances,...publicEntrances];
  for(const entrance of entrances) {
    const start=[entrance.x,entrance.z],candidates=[];
    const near=nearestStreet(start);
    // A doorstep already inside a street's paving has a valid connection;
    // drawing another ribbon here would create a z-fighting double surface.
    let best=near.point&&near.distance<.72?{
      score:0,draw:null,full:near.distance<.0001?[start]:[start,near.point],
    }:null;
    if(!best){
    for(const road of streets)for(let i=1;i<road.p.length;i++) {
      const a=road.p[i-1],b=road.p[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=clamp(((start[0]-a[0])*dx+(start[1]-a[1])*dz)/(dx*dx+dz*dz),0,1);
      const end=[a[0]+dx*t,a[1]+dz*t],distance=Math.hypot(start[0]-end[0],start[1]-end[1]);
      if(distance>.7&&distance<39)candidates.push({end,distance});
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    for(const {end} of candidates.slice(0,28)) {
      for(const points of orthogonalConnections(start,end,entrance)){
        const score=routeLength(points)+pathConflicts(points)*22+(points.length-2)*.7;
        if(!best||score<best.score)best={score,draw:points,full:points};
      }
    }
    // A house may feed an existing paved footpath as a T-junction. Only the
    // new branch is drawn, so shared segments never render on top of each other.
    for(let p=0;p<drawnPaths.length;p++)for(let i=1;i<drawnPaths[p].length;i++){
      const end=nearestOnSegment(start,drawnPaths[p][i-1],drawnPaths[p][i]);
      const distance=Math.hypot(start[0]-end[0],start[1]-end[1]);
      if(distance<.65||distance>9)continue;
      for(const draw of orthogonalConnections(start,end,entrance)){
        const score=routeLength(draw)+.6+pathConflicts(draw,true)*22;
        if(!best||score<best.score)best={score,draw,full:[...draw,...routedPaths[p].slice(i)]};
      }
    }
    if(!best){
      const detour=detourToStreet(entrance,start);
      if(detour)best={score:routeLength(detour),draw:detour,full:detour};
    }
    }
    if(!best)continue;
    const material=['landmark','market'].includes(entrance.kind)?'paving':entrance.kind==='garden'?'stonePath':
      ['industrial','hill'].includes(entrance.lot?.style)?'stonePath':'road';
    const width=entrance.width??.66;
    if(best.draw){
      const pathLevel=.046-drawnPaths.length*.000006;
      ribbon(best.draw,width,material,pathLevel,{rough:.01,
        elevation:(x,z)=>pavedRoadHeight(x,z,pathLevel)});
      if(entrance.kind!=='garden')roadStairs(best.draw,width,pathLevel);
      drawnPaths.push(best.draw);routedPaths.push(best.full);
    }
    const record={id:entrance.id,kind:entrance.kind,p:best.full,width};
    if(entrance.kind==='house')housePaths.push(best.full);
    else if(entrance.kind==='landmark')landmarkPaths.push(record);
    else publicPaths.push(record);
    anchors.push({id:entrance.id,kind:entrance.kind,x:entrance.x,z:entrance.z});
    paths.push(record);
  }
  return {paths,anchors};
}
