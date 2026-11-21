// Shared pedestrian topology for the city, courtyards and landmark approaches.
// Visual paving remains owned by the scene; every junction is represented once.
const EPS=1e-5;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];

function projection(point,a,b){
  const delta=subtract(b,a),length=delta[0]**2+delta[1]**2;
  const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*delta[0]+(point[1]-a[1])*delta[1])/length)):0;
  return {t,point:[a[0]+delta[0]*t,a[1]+delta[1]*t]};
}

function intersections(a,b,c,d){
  const ab=subtract(b,a),cd=subtract(d,c),ac=subtract(c,a);
  const denominator=cross(ab,cd);
  if(Math.abs(denominator)>EPS){
    const t=cross(ac,cd)/denominator,u=cross(ac,ab)/denominator;
    return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?
      [[a[0]+ab[0]*Math.max(0,Math.min(1,t)),a[1]+ab[1]*Math.max(0,Math.min(1,t))]]:[];
  }
  if(Math.abs(cross(ac,ab))>EPS)return [];
  // Collinear streets may share only part of a segment. Split at both ends.
  return [a,b,c,d].filter(point=>{
    const onFirst=projection(point,a,b),onSecond=projection(point,c,d);
    return distance(point,onFirst.point)<EPS&&distance(point,onSecond.point)<EPS;
  });
}

export function buildPedestrianNetwork({roads=[],paths=[],anchors=[]}={}){
  const sources=[...roads.map((road,index)=>({id:road.id??`road-${index}`,kind:'street',p:road.p})),...paths];
  const segments=[];
  for(const source of sources){
    for(let i=1;i<source.p.length;i++){
      const a=source.p[i-1],b=source.p[i];
      if(distance(a,b)<EPS)continue;
      segments.push({sourceId:source.id,kind:source.kind??'path',a,b,cuts:[{t:0,p:a},{t:1,p:b}]});
    }
  }
  function cut(segment,point){
    const {t,point:projected}=projection(point,segment.a,segment.b);
    if(distance(projected,point)<.0005)segment.cuts.push({t,p:projected});
  }
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j];
    if(Math.max(Math.min(a.a[0],a.b[0]),Math.min(b.a[0],b.b[0]))>
      Math.min(Math.max(a.a[0],a.b[0]),Math.max(b.a[0],b.b[0]))+EPS)continue;
    if(Math.max(Math.min(a.a[1],a.b[1]),Math.min(b.a[1],b.b[1]))>
      Math.min(Math.max(a.a[1],a.b[1]),Math.max(b.a[1],b.b[1]))+EPS)continue;
    for(const point of intersections(a.a,a.b,b.a,b.b)){cut(a,point);cut(b,point);}
  }
  for(const anchor of anchors)for(const segment of segments)cut(segment,[anchor.x,anchor.z]);
  const nodes=[],edges=[],nodeIndex=new Map(),edgeIndex=new Set();
  const nodeAt=p=>{
    const key=`${Math.round(p[0]*10000)},${Math.round(p[1]*10000)}`;
    if(!nodeIndex.has(key)){
      nodeIndex.set(key,nodes.length);
      nodes.push({id:nodes.length,x:p[0],z:p[1],edges:[]});
    }
    return nodeIndex.get(key);
  };
  for(const segment of segments){
    segment.cuts.sort((a,b)=>a.t-b.t);
    for(let i=1;i<segment.cuts.length;i++){
      const start=segment.cuts[i-1],end=segment.cuts[i];
      if(distance(start.p,end.p)<.0001)continue;
      const from=nodeAt(start.p),to=nodeAt(end.p);
      const key=[Math.min(from,to),Math.max(from,to)].join(':');
      if(edgeIndex.has(key))continue;
      edgeIndex.add(key);
      const id=edges.length;
      edges.push({id,from,to,kind:segment.kind,sourceId:segment.sourceId,length:distance(start.p,end.p)});
      nodes[from].edges.push(id);nodes[to].edges.push(id);
    }
  }
  const anchorNodes=new Map();
  for(const anchor of anchors){
    const key=`${Math.round(anchor.x*10000)},${Math.round(anchor.z*10000)}`;
    if(nodeIndex.has(key))anchorNodes.set(anchor.id,nodeIndex.get(key));
  }
  const findRoute=(fromId,toId)=>{
    const from=anchorNodes.get(fromId),to=anchorNodes.get(toId);
    if(from===undefined||to===undefined)return null;
    const best=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1);
    const heap=[];
    const push=(cost,id)=>{
      heap.push({cost,id});let i=heap.length-1;
      while(i){const parent=(i-1)>>1;if(heap[parent].cost<=cost)break;
        heap[i]=heap[parent];i=parent;}heap[i]={cost,id};
    };
    const pop=()=>{
      const first=heap[0],last=heap.pop();
      if(heap.length){let i=0;
        while(i*2+1<heap.length){let child=i*2+1;
          if(child+1<heap.length&&heap[child+1].cost<heap[child].cost)child++;
          if(last.cost<=heap[child].cost)break;
          heap[i]=heap[child];i=child;
        }heap[i]=last;
      }
      return first;
    };
    best[from]=0;push(0,from);
    while(heap.length){
      const {cost,id}=pop();if(cost>best[id]+EPS)continue;
      if(id===to){const route=[];
        for(let n=to;n!==-1;n=previous[n])route.push([nodes[n].x,nodes[n].z]);
        return route.reverse();
      }
      for(const edgeId of nodes[id].edges){
        const edge=edges[edgeId],next=edge.from===id?edge.to:edge.from,score=cost+edge.length;
        if(score>=best[next]-EPS)continue;
        best[next]=score;previous[next]=id;push(score,next);
      }
    }
    return null;
  };
  return {nodes,edges,anchors:anchors.map(anchor=>({...anchor,nodeId:anchorNodes.get(anchor.id)??null})),findRoute};
}
