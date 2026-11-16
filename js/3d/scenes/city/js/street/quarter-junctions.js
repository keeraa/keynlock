// Ground-plane geometry shared by the intersection stone mask and the curved
// sidewalk connectors. Coordinates inside a junction are relative to its node.
const vec=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const scale=(v,s)=>[v[0]*s,v[1]*s];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const midpoint=(a,b)=>scale(vec(a,b),.5);
const quadratic=(a,control,b,t)=>{
  const inv=1-t;
  return [inv*inv*a[0]+2*inv*t*control[0]+t*t*b[0],
    inv*inv*a[1]+2*inv*t*control[1]+t*t*b[1]];
};
const orient=(a,b,c)=>cross([b[0]-a[0],b[1]-a[1]],[c[0]-a[0],c[1]-a[1]]);
const polygonArea=polygon=>polygon.reduce((sum,a,i)=>{
  const b=polygon[(i+1)%polygon.length];return sum+cross(a,b);
},0)/2;

function selfIntersects(polygon) {
  for(let i=0;i<polygon.length;i++)for(let j=i+2;j<polygon.length;j++){
    if(i===0&&j===polygon.length-1)continue;
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const c=polygon[j],d=polygon[(j+1)%polygon.length];
    if(orient(a,b,c)*orient(a,b,d)<-1e-6&&orient(c,d,a)*orient(c,d,b)<-1e-6)return true;
  }
  return false;
}

function convexHull(points) {
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const lower=[],upper=[];
  for(const p of sorted){
    while(lower.length>1&&orient(lower.at(-2),lower.at(-1),p)<=0)lower.pop();
    lower.push(p);
  }
  for(const p of sorted.reverse()){
    while(upper.length>1&&orient(upper.at(-2),upper.at(-1),p)<=0)upper.pop();
    upper.push(p);
  }
  lower.pop();upper.pop();
  return [...lower,...upper];
}

export function junctionArms(plan,junction) {
  const arms=[];
  for(const line of plan.roads.lines){
    const index=line.path.findIndex(([x,z])=>Math.hypot(x-junction.x,z-junction.z)<.001);
    if(index<0)continue;
    for(const neighbor of [line.path[index-1],line.path[index+1]]){
      if(!neighbor)continue;
      const dx=neighbor[0]-junction.x,dz=neighbor[1]-junction.z;
      const length=Math.hypot(dx,dz);
      if(length<.01)continue;
      arms.push({roadId:line.id,direction:[dx/length,dz/length],half:line.width/2,
        walk:line.walkWidth,angle:Math.atan2(dz,dx)});
    }
  }
  return arms.sort((a,b)=>a.angle-b.angle);
}

export function junctionContainsStone(x,z,arms,margin=.14) {
  // x/z are LOCAL to this crossing. Comparing these with world coordinates
  // left almost every remote intersection completely without paving stones.
  return arms.some(({direction:[dx,dz],half})=>{
    const along=x*dx+z*dz;
    const across=Math.abs(x*dz-z*dx);
    return along>=-.12&&across<=half-margin;
  });
}

function lineCrossing(p,dir,q,other) {
  const denominator=cross(dir,other);
  if(Math.abs(denominator)<.09)return null;
  const t=cross([q[0]-p[0],q[1]-p[1]],other)/denominator;
  return vec(p,scale(dir,t));
}

export function junctionSidewalkCorners(arms) {
  if(arms.length<3)return [];
  const maxWidth=Math.max(...arms.map(arm=>arm.half*2));
  const maxWalk=Math.max(...arms.map(arm=>arm.walk));
  // This is the same setback used when the straight sidewalk ribbons stop.
  const cut=maxWidth/2+maxWalk*.75+.34;
  return arms.map((a,i)=>{
    const b=arms[(i+1)%arms.length];
    const normalA=[-a.direction[1],a.direction[0]];
    const normalB=[b.direction[1],-b.direction[0]];
    const at=(arm,normal,offset)=>vec(scale(arm.direction,cut),scale(normal,offset));
    const innerA=at(a,normalA,a.half),innerB=at(b,normalB,b.half);
    const span=((b.angle-a.angle+Math.PI*2)%(Math.PI*2));
    const intersect=lineCrossing(scale(normalA,a.half),a.direction,
      scale(normalB,b.half),b.direction);
    const middle=midpoint(innerA,innerB);
    const towards=intersect?[intersect[0]-middle[0],intersect[1]-middle[1]]:[0,0];
    const distance=Math.hypot(...towards);
    const allowance=Math.min(.5,Math.hypot(innerB[0]-innerA[0],innerB[1]-innerA[1])*.27);
    // Only a modest bow is allowed near acute bends, or the curve folds over
    // itself and the pavement polygon becomes a bow-tie.
    const innerControl=span>Math.PI*.89||!intersect?middle:
      vec(middle,scale(towards,Math.min(1,allowance/(distance||1))));
    const inner=[],outer=[],curb=[];
    for(let step=0;step<=8;step++){
      const t=step/8;
      const point=quadratic(innerA,innerControl,innerB,t);
      const n=vec(scale(normalA,1-t),scale(normalB,t));
      inner.push(point);
      outer.push(vec(point,vec(scale(normalA,a.walk*(1-t)),scale(normalB,b.walk*t))));
      curb.push(vec(point,scale(n,.07)));
    }
    let polygon=[...inner,...outer.slice().reverse()];
    // Acute or uneven branches may already overlap the sidewalk margins.
    // Avoid a self-crossing paved bow-tie in that case. Their convex envelope
    // seals the approaches while keeping the whole patch inside the corner.
    if(polygonArea(polygon)>-.25||selfIntersects(polygon)){
      polygon=convexHull(polygon);
      curb.splice(0,curb.length,...[inner[0],midpoint(inner[0],inner.at(-1)),inner.at(-1)]);
    }
    return {inner,outer,curb,polygon,
      roads:[a.roadId,b.roadId]};
  });
}
