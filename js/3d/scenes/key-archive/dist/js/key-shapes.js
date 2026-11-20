import * as THREE from '../vendor/three.js';

function polar(count, rx, ry=rx, phase=Math.PI/2, offset=0) {
  return Array.from({length:count},(_,i)=>{
    const a=phase+2*Math.PI*i/count; return [Math.cos(a)*(rx+offset),Math.sin(a)*(ry+offset)];
  });
}

export function bowPoints(kind) {
  switch(kind) {
    case 'circle': return polar(32,.48);
    case 'oval': return polar(40,.36,.62);
    case 'gothic': return [[-.44,-.42],[-.50,-.19],[-.46,.12],[-.32,.41],[0,.67],[.32,.41],[.46,.12],[.50,-.19],[.44,-.42],[.23,-.52],[-.23,-.52]];
    case 'square': return [[-.43,-.48],[.43,-.48],[.52,-.39],[.52,.39],[.43,.48],[-.43,.48],[-.52,.39],[-.52,-.39]];
    case 'diamond': return [[0,.63],[.50,0],[0,-.63],[-.50,0]];
    case 'gear': return Array.from({length:48},(_,i)=>{const a=Math.PI/2+i*Math.PI/24,r=i%4===0||i%4===1?.54:.43;return [Math.cos(a)*r,Math.sin(a)*r];});
    case 'clover': return Array.from({length:48},(_,i)=>{const a=Math.PI/2+i*Math.PI/24,r=.405+.112*Math.cos(4*a);return [Math.cos(a)*r,Math.sin(a)*r];});
    case 'hexagon': return polar(6,.54,.54,Math.PI/6);
    case 'star': return Array.from({length:16},(_,i)=>{const a=Math.PI/2+i*Math.PI/8,r=i%2===0?.59:.33;return [Math.cos(a)*r,Math.sin(a)*r];});
    case 'twin': return polar(40,.40,.70);
    default: return polar(40,.48);
  }
}

// 16 sides: the facets stay under a pixel even at full zoom and hide inside
// the 1.5 px ink outline (20 sides cost a quarter more triangles per hole).
function ellipsePoints(cx,cy,rx,ry=rx,count=16) {
  return Array.from({length:count},(_,i)=>{const a=2*Math.PI*i/count;return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});
}

export function holesFor(kind) {
  if(kind==='twin') return [ellipsePoints(0,.29,.16,.19),ellipsePoints(0,-.29,.16,.19)];
  if(kind==='gothic') return [ellipsePoints(0,-.015,.16,.23)];
  if(kind==='oval') return [ellipsePoints(0,0,.13,.32)];
  if(kind==='diamond') return [[[0,.245],[.17,0],[0,-.245],[-.17,0]]];
  if(kind==='square') return [ellipsePoints(0,0,.175,.175,4)];
  if(kind==='star') return [ellipsePoints(0,0,.14)];
  return [ellipsePoints(0,0,.18)];
}

export function pathFromPoints(points) {
  const shape=new THREE.Shape(); shape.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++) shape.lineTo(...points[i]);
  shape.closePath(); return shape;
}

export function createBowShape(kind) {
  const shape=pathFromPoints(bowPoints(kind));
  for(const holePoints of holesFor(kind)) {
    const hole=new THREE.Path(); hole.moveTo(...holePoints[0]);
    for(let i=1;i<holePoints.length;i++) hole.lineTo(...holePoints[i]);
    hole.closePath(); shape.holes.push(hole);
  }
  return shape;
}


export function shaftHalfHeight(template) {
  return ['forge','tower'].includes(template.id)?.135:.105;
}

function rightContourAtY(points,y) {
  let right=-Infinity;
  for(let i=0;i<points.length;i++) {
    const [ax,ay]=points[i], [bx,by]=points[(i+1)%points.length];
    if((ay<=y&&by>y)||(by<=y&&ay>y)) {
      const x=ax+(bx-ax)*(y-ay)/(by-ay);
      right=Math.max(right,x);
    }
  }
  return right;
}

// Locate the neck on the solid outer rim for each silhouette and head size.
// A narrow overlap joins the metal bodies, while the finger hole remains clear.
export function shaftStartX(template,design) {
  const scale=design.headSize/100;
  const half=shaftHalfHeight(template);
  const outline=bowPoints(template.bow);
  const boundary=Math.min(...[-half,0,half].map(y=>rightContourAtY(outline,y/scale)));
  return -1.21+boundary*scale-.035;
}


function simplifyPolyline(points,tolerance=.006) {
  if(points.length<=2)return points;
  const keep=new Uint8Array(points.length);
  keep[0]=keep[points.length-1]=1;
  const toleranceSquared=tolerance*tolerance;
  function recurse(first,last) {
    const [ax,ay]=points[first], [bx,by]=points[last];
    const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
    let farthest=-1,maxDistance=0;
    for(let i=first+1;i<last;i++) {
      const [x,y]=points[i];
      const t=lengthSquared>0?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/lengthSquared)):0;
      const vx=x-ax-t*dx,vy=y-ay-t*dy;
      const distance=vx*vx+vy*vy;
      if(distance>maxDistance){maxDistance=distance;farthest=i;}
    }
    if(maxDistance>toleranceSquared) {
      keep[farthest]=1;
      recurse(first,farthest);recurse(farthest,last);
    }
  }
  recurse(0,points.length-1);
  return points.filter((_,i)=>keep[i]);
}

// The blade is an extruded closed profile; its cuts are genuine geometry.
export function bladeProfile(template, design, sampleCount=210) {
  const start=shaftStartX(template,design);
  const end=start+design.shaftLength;
  const half=shaftHalfHeight(template);
  const depth=design.cutDepth/100;
  const teeth=Math.max(2,Math.min(7,design.teeth));
  const style=template.blade;
  function edge(u,lower=false) {
    const base=half*(u>.99?.8:1);
    if(lower && !design.doubleSided) return -base;
    const trigger=style==='serrated'?.32:.60;
    if(u<trigger) return lower?-base:base;
    const v=(u-trigger)/(1-trigger);
    const index=Math.min(teeth-1,Math.floor(v*teeth));
    const part=v*teeth-index;
    let strength=0;
    if(style==='serrated') strength=.25+(.75*Math.max(0,1-Math.abs(part-.48)*2))*(.54+.46*((index*7+3)%5)/4);
    else if(style==='comb') strength=part>.22&&part<.70?(.80-.20*(index%2)):.13;
    else if(style==='ornate') strength=.25+.72*Math.max(0,Math.sin(part*Math.PI))*(index%2?.75:1);
    else if(style==='stepped') strength=part>.15&&part<.83?(.36+.64*((index*3+2)%4)/3):.05;
    else if(style==='fork') strength=part>.12&&part<.86?(index%2?.45:.95):.08;
    else if(style==='double') strength=part>.1&&part<.80?(index%2?.65:1):.08;
    else strength=part>.16&&part<.82?(index%2?.63:1):.06;
    if(lower) return -base-depth*strength*(style==='fork'?1:.83);
    return base+depth*strength;
  }
  const top=[],bottom=[];
  for(let i=0;i<=sampleCount;i++) {
    const u=i/sampleCount;const x=start+(end-start)*u;
    top.push([x,edge(u,false)]);bottom.push([x,edge(u,true)]);
  }
  // The blade butts exactly against the bow's outer rim instead of reaching
  // inside it. Both have the same thickness, so their faces meet edge to edge
  // with no overlap and no step: nothing for the depth buffer to fight over.
  const rim=bowRimBetween(template,design,-half,half);
  const rimTop=rim[rim.length-1],rimBottom=rim[0];
  const topEdge=simplifyPolyline(top).filter(([x])=>x>rimTop[0]+1e-6);
  const bottomEdge=simplifyPolyline(bottom).filter(([x])=>x>rimBottom[0]+1e-6);
  return [rimTop,...topEdge,...bottomEdge.reverse(),...rim.slice(0,-1)];
}

// The bow's right-hand outline between two heights, bottom to top, in key
// coordinates. It includes every bow vertex in that band, so the blade's edge
// lies exactly on the bow's edge.
function bowRimBetween(template,design,low,high) {
  const scale=design.headSize/100;
  const outline=bowPoints(template.bow);
  const toKey=([x,y])=>[-1.21+x*scale,y*scale];
  const points=[[rightContourAtY(outline,low/scale),low/scale],[rightContourAtY(outline,high/scale),high/scale]];
  for(const [x,y] of outline) {
    if(y*scale<=low||y*scale>=high)continue;
    if(Math.abs(x-rightContourAtY(outline,y))<1e-9)points.push([x,y]);
  }
  return points.sort((a,b)=>a[1]-b[1]).map(toKey);
}

// A broken/bent key is a single solid outline. A mitered corner connects the
// two parts without intersecting caps, exposed seam walls or a Z offset.

export function keyBreakAngle(design) {
  return design.broken?Math.max(60,Math.min(80,Number(design.breakAngle)||70)):0;
}

export function keyBreakX(template,design) {
  const straightEnd=template.blade==='serrated'?.32:.60;
  return shaftStartX(template,design)+design.shaftLength*straightEnd*.70;
}

export function bladeSections(template,design,sampleCount=210) {
  const full=bladeProfile(template,design,sampleCount);
  if(!design.broken)return [full];
  const hinge=keyBreakX(template,design);
  const angle=-keyBreakAngle(design)*Math.PI/180;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const half=shaftHalfHeight(template);
  const join=half*Math.tan(-angle/2);
  const rightmost=Math.max(...full.map(p=>p[0]));
  const split=full.findIndex(p=>p[0]===rightmost);
  const top=full.slice(0,split+1),bottom=full.slice(split+1).reverse();
  const turn=([x,y])=>{
    const dx=x-hinge;
    return [hinge+dx*cos-y*sin,dx*sin+y*cos];
  };
  const epsilon=1e-7;
  const outline=[
    ...top.filter(p=>p[0]<hinge-epsilon),
    [hinge+join,half],
    turn([hinge,half]),
    ...top.filter(p=>p[0]>hinge+epsilon).map(turn),
    ...bottom.filter(p=>p[0]>hinge+join+epsilon).reverse().map(turn),
    [hinge-join,-half],
    ...bottom.filter(p=>p[0]<hinge-epsilon).reverse(),
  ];
  return [outline];
}

// The whole key as ONE outline: the bow's contour with its rim between the
// blade's edges replaced by the blade itself, plus the bow's finger holes.
// One extrusion has no walls hidden inside the joint and no seam at all.
export function keyOutline(template,design) {
  const scale=design.headSize/100,half=shaftHalfHeight(template);
  const place=points=>points.map(([x,y])=>[-1.21+x*scale,y*scale]);
  let head=place(bowPoints(template.bow));
  const area=head.reduce((sum,[x,y],i)=>{const [nx,ny]=head[(i+1)%head.length];return sum+x*ny-nx*y;},0);
  if(area<0)head=head.reverse();                       // counter-clockwise
  const leftmost=head.reduce((best,p,i)=>p[0]<head[best][0]?i:best,0);
  head=[...head.slice(leftmost),...head.slice(0,leftmost)];
  const rim=bowRimBetween(template,design,-half,half);
  const rimBottom=rim[0],rimTop=rim[rim.length-1];
  const blade=bladeSections(template,design)[0];
  const middle=blade.slice(1,blade.length-(rim.length-1)).reverse();
  // Rising edges of the right-hand side that hold the rim's end points.
  const onEdge=(point,i)=>{
    const [ax,ay]=head[i],[bx,by]=head[(i+1)%head.length];
    if(!(ay<=point[1]+1e-9&&by>=point[1]-1e-9))return false;
    const x=ay===by?ax:ax+(bx-ax)*(point[1]-ay)/(by-ay);
    return Math.abs(x-point[0])<1e-7;
  };
  const k=head.findIndex((_,i)=>onEdge(rimBottom,i));
  const m=head.findIndex((_,i)=>i>=k&&onEdge(rimTop,i));
  if(k<0||m<0)throw new Error(`Не удалось соединить головку и стержень: ${template.id}`);
  const outer=[...head.slice(0,k+1),rimBottom,...middle,rimTop,...head.slice(m+1)]
    .filter((p,i,list)=>{const q=list[(i+list.length-1)%list.length];return Math.hypot(p[0]-q[0],p[1]-q[1])>1e-9;});
  return {outer,holes:holesFor(template.bow).map(place)};
}

export function createKeyShape(template,design) {
  const {outer,holes}=keyOutline(template,design);
  const shape=pathFromPoints(outer);
  for(const points of holes) {
    const hole=new THREE.Path();hole.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)hole.lineTo(...points[i]);
    hole.closePath();shape.holes.push(hole);
  }
  return shape;
}

// The Key Archive's name for the same single outline.
export function joinedKeyShape(template,design) { return createKeyShape(template,design); }

export function keyBounds(template,design) {
  const scale=design.headSize/100;
  const points=[...bowPoints(template.bow).map(([x,y])=>[-1.21+x*scale,y*scale]),
    ...bladeSections(template,design).flat()];
  return {
    minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),
    minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1])),
  };
}
