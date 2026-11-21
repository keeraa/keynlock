// Keep a compact editable river centerline while preserving its turns.
// Water geometry is generated separately from all strokes as a single mask.
export function simplifyRiverPoints(points,tolerance=.65){
  if(points.length<=2)return points.map(p=>[...p]);
  const keep=new Uint8Array(points.length);keep[0]=1;keep[points.length-1]=1;
  const stack=[[0,points.length-1]],threshold=tolerance*tolerance;
  while(stack.length){
    const [from,to]=stack.pop(),a=points[from],b=points[to];
    const dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
    let best=threshold,selected=-1;
    for(let i=from+1;i<to;i++){
      const p=points[i],t=len2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/len2)):0;
      const d2=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dz)**2;
      if(d2>best){best=d2;selected=i;}
    }
    if(selected!==-1){keep[selected]=1;stack.push([from,selected],[selected,to]);}
  }
  return points.filter((_,i)=>keep[i]).map(p=>[...p]);
}
