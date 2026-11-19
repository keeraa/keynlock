import * as THREE from '../vendor/three.js';
import { bowPoints, holesFor, bladeSections, shaftStartX, shaftHalfHeight } from './key-shapes.js';

// The grime is a genuine, uneven rim outside the silhouette. It has its own
// thin front/back crust and edge wall, but never becomes part of the STL key.
export const dirtPaint=['#54432f','#624f38','#705b42'];
const dirtColors=dirtPaint.map(color=>new THREE.Color(color));
let dirtMaterial;
export function getDirtMaterial() {
  if(!dirtMaterial) dirtMaterial=new THREE.MeshBasicMaterial({
    vertexColors:true,transparent:false,depthWrite:true,side:THREE.DoubleSide,
  });
  return dirtMaterial;
}

export function stableNoise(value) {
  const v=Math.sin(value*12.9898+78.233)*43758.5453;
  return v-Math.floor(v);
}

export function crustWidth(design) {
  const amount=Math.max(0,Math.min(100,design.dirtAmount??0))/100;
  return amount>0?.007+.083*amount:0;
}

function contourCrust(points,width,seed,invert=false) {
  const signedArea=points.reduce((area,[x,y],i)=>{
    const [nx,ny]=points[(i+1)%points.length];return area+x*ny-nx*y;
  },0);
  const direction=(signedArea>=0?1:-1)*(invert?-1:1);
  const outer=[];
  for(let i=0;i<points.length;i++) {
    const previous=points[(i+points.length-1)%points.length];
    const current=points[i],next=points[(i+1)%points.length];
    const ax=current[0]-previous[0],ay=current[1]-previous[1];
    const bx=next[0]-current[0],by=next[1]-current[1];
    const aLength=Math.hypot(ax,ay)||1,bLength=Math.hypot(bx,by)||1;
    const an=[direction*ay/aLength,-direction*ax/aLength];
    const bn=[direction*by/bLength,-direction*bx/bLength];
    let nx=an[0]+bn[0],ny=an[1]+bn[1];
    const nLength=Math.hypot(nx,ny)||1;nx/=nLength;ny/=nLength;
    // Short corner miters keep star/gear teeth from growing into large spikes.
    const miter=Math.min(1.15,1/Math.max(.78,nx*bn[0]+ny*bn[1]));
    const irregularity=.88+.085*Math.sin(i*.43+seed*2.3)
      +.035*Math.sin(i*.19+seed*1.2)+.035*(stableNoise(i*3.7+seed*37)-.5);
    const spread=width*irregularity*miter;
    outer.push([current[0]+nx*spread,current[1]+ny*spread]);
  }
  // The inner edge is the metal contour itself. It must not cross the key's
  // front/back faces and create the muddy patches visible through its paint.
  return {outer,inner:points};
}

export function dirtSections(template,design) {
  const scale=design.headSize/100,depth=design.thickness/100;
  const bladeDepth=Math.max(.02,depth-.008),bladeOffset=(depth-bladeDepth)/2;
  const headPoints=bowPoints(template.bow).map(([x,y])=>[x*scale-1.21,y*scale]);
  const sections=[{kind:'head',points:headPoints,seed:design.template*7+1,
    top:depth,bottom:0,invert:false}];
  for(const [index,hole] of holesFor(template.bow).entries()) {
    sections.push({kind:'hole',points:hole.map(([x,y])=>[x*scale-1.21,y*scale]),
      seed:design.template*11+index+7,top:depth,bottom:0,invert:true});
  }
  for(const points of bladeSections(template,design))
    sections.push({kind:'blade',points,seed:design.template*13+3,
      top:bladeDepth+bladeOffset,bottom:bladeOffset,invert:false});
  return sections;
}

function exposedDirtEdge(section,index,neck,half,width) {
  const a=section.points[index],b=section.points[(index+1)%section.points.length];
  const midX=(a[0]+b[0])/2,midY=(a[1]+b[1])/2;
  if(section.kind==='head'&&midX>neck-.02&&Math.abs(midY)<half+width*.5)return false;
  if(section.kind==='blade'&&midX<neck+.042)return false;
  return true;
}

function distanceToSegment(point,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const denominator=dx*dx+dy*dy;
  const t=denominator?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/denominator)):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}

// Keep every sharp tooth and every neck cut. Remove only near-collinear points
// on BOTH borders, so fewer quads are needed without changing the visible rim.
export function dirtSegments(section,width,neck,half) {
  const {points}=section,n=points.length;
  const ring=contourCrust(points,width,section.seed,section.invert);
  const exposed=Array.from({length:n},(_,i)=>exposedDirtEdge(section,i,neck,half,width));
  const protectedPoints=new Uint8Array(n);
  for(let i=0;i<n;i++)if(!exposed[i]) {
    protectedPoints[i]=1;protectedPoints[(i+1)%n]=1;
  }
  const kept=Array.from({length:n},(_,i)=>i);
  let removed=true;
  while(removed&&kept.length>3) {
    removed=false;
    for(let k=0;k<kept.length&&kept.length>3;k++) {
      const i=kept[k];if(protectedPoints[i])continue;
      const prev=kept[(k+kept.length-1)%kept.length];
      const next=kept[(k+1)%kept.length];
      if(distanceToSegment(points[i],points[prev],points[next])>.004||
         distanceToSegment(ring.outer[i],ring.outer[prev],ring.outer[next])>.004)continue;
      kept.splice(k,1);removed=true;k--;
    }
  }
  const segments=[];
  for(let k=0;k<kept.length;k++) {
    const i=kept[k],j=kept[(k+1)%kept.length];
    let visible=true;
    for(let cursor=i;cursor!==j;cursor=(cursor+1)%n)if(!exposed[cursor]) {
      visible=false;break;
    }
    if(visible)segments.push([i,j]);
  }
  return {ring,segments};
}

export function dirtTriangles(template,design) {
  const width=crustWidth(design);
  const sections=dirtSections(template,design),neck=shaftStartX(template,design),half=shaftHalfHeight(template);
  const positions=[],colors=[];
  function triangle(a,b,c,ca,cb,cc) {
    positions.push(...a,...b,...c);
    colors.push(...ca.toArray(),...cb.toArray(),...cc.toArray());
  }
  function quad(a,b,c,d,ca,cb,cc,cd) {
    triangle(a,b,c,ca,cb,cc);triangle(a,c,d,ca,cc,cd);
  }
  for(const section of sections) {
    const {ring,segments}=dirtSegments(section,width,neck,half);
    for(const [i,j] of segments) {
      const top=section.top+.009,back=section.bottom-.009;
      const outerA=[...ring.outer[i],top],outerB=[...ring.outer[j],top];
      const innerA=[...ring.inner[i],top],innerB=[...ring.inner[j],top];
      const backA=[...ring.outer[i],back],backB=[...ring.outer[j],back];
      const backInnerA=[...ring.inner[i],back],backInnerB=[...ring.inner[j],back];
      const colorA=dirtColors[Math.floor(stableNoise(i*4.1+section.seed*17)*3)];
      const colorB=dirtColors[Math.floor(stableNoise(j*4.1+section.seed*17)*3)];
      quad(outerA,outerB,innerB,innerA,colorA,colorB,colorB,colorA);
      quad(backB,backA,backInnerA,backInnerB,colorB,colorA,colorA,colorB);
      quad(backA,backB,outerB,outerA,colorA,colorB,colorB,colorA);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}
