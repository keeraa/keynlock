import {BLADE_LEFT,BLADE_RIGHT,KEY_BOTTOM_Y,KEY_TOP_Y,
  TIP_START_X,TIP_BOTTOM_Y} from './logic.js';

export const KEY_BLADE_DEPTH=.085;
export const KEY_BLADE_OFFSET_Z=.015;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;

export function keyBladeBottomAt(x){
  return x<=TIP_START_X?KEY_BOTTOM_Y:
    mix(KEY_BOTTOM_Y,TIP_BOTTOM_Y,clamp((x-TIP_START_X)/(BLADE_RIGHT-TIP_START_X),0,1));
}

// Parallel grooves are milled straight along the blade. The pointed nose
// physically clips their walls; their tracks never curl to follow its edges.
export function keyBladeGrooveRidges(x){
  const result=[];
  for(const center of [-.195,-.135]){
    const half=.015,shoulder=.008,depth=.017;
    result.push([center-half-shoulder,0],
      [center-half,depth],[center+half,depth],
      [center+half+shoulder,0]);
  }
  return result;
}

function sectionRidges(x){
  return [[KEY_BOTTOM_Y,0],...keyBladeGrooveRidges(x),[KEY_TOP_Y,0]];
}

export function keyBladeRecessAt(x,y){
  const knots=sectionRidges(x);
  for(let i=1;i<knots.length;i++){
    const [aY,aDepth]=knots[i-1],[bY,bDepth]=knots[i];
    if(y<=bY)return mix(aDepth,bDepth,clamp((y-aY)/(bY-aY),0,1));
  }
  return 0;
}

export function keyBladeFaceZ(x,y,face='front'){
  const recess=keyBladeRecessAt(x,y);
  return KEY_BLADE_OFFSET_Z+(face==='front'?KEY_BLADE_DEPTH-recess:recess);
}

// Convex polygon clipping against the surviving top/bottom edge of a tooth.
// Every front/back triangle belongs to the actual metal; long, deep notches
// cannot be bridged by a general-purpose polygon triangulator.
function clipAboveLine(polygon,heightAt,above){
  const clipped=[];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const da=above?a[1]-heightAt(a[0]):heightAt(a[0])-a[1];
    const db=above?b[1]-heightAt(b[0]):heightAt(b[0])-b[1];
    const ia=da>=-1e-9,ib=db>=-1e-9;
    const intersection=()=>{
      const t=clamp(da/(da-db),0,1);
      return [mix(a[0],b[0],t),mix(a[1],b[1],t)];
    };
    if(ia&&ib)clipped.push(b);
    else if(ia&&!ib)clipped.push(intersection());
    else if(!ia&&ib)clipped.push(intersection(),b);
  }
  return clipped;
}

function bladeSections(topPoints){
  const sections=[];
  for(let i=1;i<topPoints.length;i++){
    const [x0,y0]=topPoints[i-1],[x1,y1]=topPoints[i];
    if(x1<=x0+1e-9)continue;
    const points=[[x0,y0]];
    if(x0<TIP_START_X&&x1>TIP_START_X)points.push([
      TIP_START_X,mix(y0,y1,(TIP_START_X-x0)/(x1-x0))]);
    const first=Math.max(x0,TIP_START_X),tail=x1-first;
    if(tail>.001){
      const steps=Math.ceil(tail/.065);
      for(let j=1;j<steps;j++){
        const x=first+tail*j/steps;
        points.push([x,mix(y0,y1,(x-x0)/(x1-x0))]);
      }
    }
    points.push([x1,y1]);
    for(let j=1;j<points.length;j++)sections.push([points[j-1],points[j]]);
  }
  return sections;
}

export function createKeyBladeGeometry(THREE,topPoints,originX=0){
  const positions=[],uv=[];
  function triangle(a,b,c){
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    if(cross[0]**2+cross[1]**2+cross[2]**2<1e-17)return;
    for(const p of [a,b,c]){
      positions.push(p[0]-originX,p[1],p[2]);
      uv.push(p[0],p[1]);
    }
  }
  function quad(a,b,c,d){triangle(a,b,c);triangle(a,c,d);}

  for(const [[x0,top0],[x1,top1]] of bladeSections(topPoints)){
    const a=sectionRidges(x0),b=sectionRidges(x1);
    const topAt=x=>mix(top0,top1,(x-x0)/(x1-x0));
    for(let band=0;band<a.length-1;band++){
      let polygon=[[x0,a[band][0]],[x1,b[band][0]],
        [x1,b[band+1][0]],[x0,a[band+1][0]]];
      polygon=clipAboveLine(polygon,keyBladeBottomAt,true);
      if(polygon.length<3)continue;
      polygon=clipAboveLine(polygon,topAt,false);
      if(polygon.length<3)continue;
      const surface=(p,front)=>{
        const t=clamp((p[0]-x0)/(x1-x0),0,1);
        const lowY=mix(a[band][0],b[band][0],t);
        const highY=mix(a[band+1][0],b[band+1][0],t);
        const fraction=clamp((p[1]-lowY)/(highY-lowY),0,1);
        const depth=mix(mix(a[band][1],b[band][1],t),
          mix(a[band+1][1],b[band+1][1],t),fraction);
        return [p[0],p[1],front?KEY_BLADE_DEPTH-depth:depth];
      };
      for(let j=1;j<polygon.length-1;j++){
        triangle(...[polygon[0],polygon[j],polygon[j+1]].map(p=>surface(p,true)));
        triangle(...[polygon[0],polygon[j+1],polygon[j]].map(p=>surface(p,false)));
      }
    }
    const f=(x,y)=>[x,y,KEY_BLADE_DEPTH-keyBladeRecessAt(x,y)];
    const back=(x,y)=>[x,y,keyBladeRecessAt(x,y)];
    quad(f(x0,top0),f(x1,top1),back(x1,top1),back(x0,top0));
    const bottom0=keyBladeBottomAt(x0),bottom1=keyBladeBottomAt(x1);
    quad(back(x0,bottom0),back(x1,bottom1),f(x1,bottom1),f(x0,bottom0));
  }

  // The bow meets the first blade cross-section exactly, without bevel or
  // end cap at the shared seam. Detached segments retain their own end caps.
  const ends=[topPoints[0],topPoints.at(-1)];
  ends.forEach(([x,top],index)=>{
    if(index===0&&Math.abs(x-BLADE_LEFT)<1e-6)return;
    const bottom=keyBladeBottomAt(x),levels=[bottom];
    for(const [y] of sectionRidges(x))if(y>bottom&&y<top)levels.push(y);
    if(top>bottom)levels.push(top);
    for(let k=1;k<levels.length;k++){
      const low=levels[k-1],high=levels[k];
      const frontLow=[x,low,KEY_BLADE_DEPTH-keyBladeRecessAt(x,low)];
      const frontHigh=[x,high,KEY_BLADE_DEPTH-keyBladeRecessAt(x,high)];
      const backLow=[x,low,keyBladeRecessAt(x,low)];
      const backHigh=[x,high,keyBladeRecessAt(x,high)];
      if(index===0)quad(frontLow,frontHigh,backHigh,backLow);
      else quad(backLow,backHigh,frontHigh,frontLow);
    }
  });

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
