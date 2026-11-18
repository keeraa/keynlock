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

function ellipsePoints(cx,cy,rx,ry=rx,count=20) {
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
  return [...simplifyPolyline(top),...simplifyPolyline(bottom).reverse()];
}

// A visibly snapped key has two independently closed metal pieces. The tip
// folds down in the plane of the key; a tiny Z step hides coplanar overlap at
// the torn joint. The cut stays in the plain shaft, before the first teeth.
export const BROKEN_TIP_Z_OFFSET=.014;

export function keyBreakAngle(design) {
  return design.broken?Math.max(60,Math.min(80,Number(design.breakAngle)||70)):0;
}

export function keyBreakX(template,design) {
  const straightEnd=template.blade==='serrated'?.32:.60;
  return shaftStartX(template,design)+design.shaftLength*straightEnd*.70;
}

function clipAtX(polygon,edgeX,keepLeft) {
  const kept=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const insideA=keepLeft?a[0]<=edgeX:a[0]>=edgeX;
    const insideB=keepLeft?b[0]<=edgeX:b[0]>=edgeX;
    if(insideA!==insideB) {
      const ratio=(edgeX-a[0])/(b[0]-a[0]);
      kept.push([edgeX,a[1]+(b[1]-a[1])*ratio]);
    }
    if(insideB)kept.push([...b]);
  }
  return kept.filter((p,i)=>i===0||Math.hypot(p[0]-kept[i-1][0],p[1]-kept[i-1][1])>1e-7);
}

export function bladeSections(template,design,sampleCount=210) {
  const full=bladeProfile(template,design,sampleCount);
  if(!design.broken)return [full];
  const hinge=keyBreakX(template,design);
  const angle=-keyBreakAngle(design)*Math.PI/180;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const left=clipAtX(full,hinge,true);
  const tip=clipAtX(full,hinge,false).map(([x,y])=>{
    const dx=x-hinge;
    return [hinge+dx*cos-y*sin,dx*sin+y*cos];
  });
  return [left,tip];
}

export function keyBounds(template,design) {
  const scale=design.headSize/100;
  const points=[...bowPoints(template.bow).map(([x,y])=>[-1.21+x*scale,y*scale]),
    ...bladeSections(template,design).flat()];
  return {
    minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),
    minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1])),
  };
}
