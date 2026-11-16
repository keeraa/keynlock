// Shared plan geometry for generation, placement and validation. All coordinates
// are in the ground plane [x,z], so no renderer is required to test the network.
export const roundRoad = n => Math.round(n*1000)/1000;
export const roadNodeId = ([x,z]) => `${roundRoad(x)}:${roundRoad(z)}`;

export function pathLength(path) {
  let total=0;
  for(let i=1;i<path.length;i++)total+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);
  return total;
}

export function pointOnPath(path,distance) {
  let remaining=Math.max(0,distance);
  for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(!length)continue;
    if(remaining<=length||i===path.length-1) {
      const t=Math.min(1,remaining/length);
      return {x:a[0]+dx*t,z:a[1]+dz*t,tangent:[dx/length,dz/length],segment:i-1};
    }
    remaining-=length;
  }
  return {x:path[0][0],z:path[0][1],tangent:[0,1],segment:0};
}

export function closestPointOnPath(path,x,z) {
  let best=null;
  for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
    if(len2<.0001)continue;
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len2));
    const px=a[0]+t*dx,pz=a[1]+t*dz,dist2=(px-x)**2+(pz-z)**2;
    if(!best||dist2<best.dist2)best={x:px,z:pz,tangent:[dx/Math.sqrt(len2),dz/Math.sqrt(len2)],dist2};
  }
  return best;
}

export function orientedRect(x,z,along,away,width,depth) {
  const w=width/2,d=depth/2;
  return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([a,b])=>
    [x+along[0]*a+away[0]*b,z+along[1]*a+away[1]*b]);
}

export function segmentCorridor(a,b,halfWidth) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
  return orientedRect((a[0]+b[0])/2,(a[1]+b[1])/2,
    [dx/length,dz/length],[-dz/length,dx/length],length,halfWidth*2);
}

export function convexOverlap(a,b,clearance=0) {
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++) {
    const p=polygon[i],q=polygon[(i+1)%polygon.length];
    const nx=p[1]-q[1],nz=q[0]-p[0],len=Math.hypot(nx,nz)||1;
    let aMin=Infinity,aMax=-Infinity,bMin=Infinity,bMax=-Infinity;
    for(const v of a){const t=(v[0]*nx+v[1]*nz)/len;aMin=Math.min(aMin,t);aMax=Math.max(aMax,t);}
    for(const v of b){const t=(v[0]*nx+v[1]*nz)/len;bMin=Math.min(bMin,t);bMax=Math.max(bMax,t);}
    if(aMax+clearance<bMin||bMax+clearance<aMin)return false;
  }
  return true;
}
