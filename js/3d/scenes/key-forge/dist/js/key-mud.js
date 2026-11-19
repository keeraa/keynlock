import * as THREE from '../vendor/three.js';
import { bowPoints, shaftStartX, shaftHalfHeight, keyBreakX, keyBreakAngle } from './key-shapes.js';
import { stableNoise } from './key-dirt.js';
import { coatGeometry, coatSvg } from './key-coat.js';

// Mud: a few dried, lumpy clods stuck to the bow, the shaft and part of the
// teeth, plus loose crumbs. Built with the same coat builder as candle wax,
// but with a ragged outline and a bumpy top. Metal stays visible between
// the clods. Decorative, never in the STL.

export const MUD_COLORS=Object.freeze({base:'#4e3924',light:'#6b5033',shade:'#2a1c10',ink:'#22170e'});
const BULGE=.03;
const CELL=.06;

export function hasMud(design) {
  return (design.dirtAmount??0)>0;
}

function valueNoise(x,y,seed) {
  const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(i,j)=>stableNoise((xi+i)*12.71+(yi+j)*78.23+seed);
  const a=h(0,0),b=h(1,0),c=h(0,1),d=h(1,1);
  return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}

export function mudBlobLayout(template,design) {
  const scale=design.headSize/100;
  const seed=design.template*5.31+9.1;
  const n=i=>stableNoise(seed+i*2.77);
  const head=bowPoints(template.bow).map(([x,y])=>[x*scale-1.21,y*scale]);
  const minX=Math.min(...head.map(p=>p[0])),maxX=Math.max(...head.map(p=>p[0]));
  const minY=Math.min(...head.map(p=>p[1])),maxY=Math.max(...head.map(p=>p[1]));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,hw=(maxX-minX)/2,hh=(maxY-minY)/2;
  const start=shaftStartX(template,design),end=start+design.shaftLength;
  const half=shaftHalfHeight(template),cut=design.cutDepth/100;
  const blobs=[];
  const add=(kind,x,y,rx,ry)=>blobs.push({kind,x,y,rx,ry});

  // Bow: one big clod on the rim with a smaller one stuck to it.
  const a=-.4+1.6*n(1);
  const bx=cx+Math.cos(a)*hw*.62,by=cy+Math.sin(a)*hh*.62;
  add('bow',bx,by,(.27+.05*n(2))*scale,(.22+.05*n(3))*scale);
  add('bow',bx+Math.cos(a+1.9)*.2*scale,by+Math.sin(a+1.9)*.2*scale,.15*scale,.13*scale);

  // Shaft: a clod wrapped around it.
  const sx=start+design.shaftLength*(design.broken?.22:.32+.15*n(4));
  add('shaft',sx,.01,.2+.04*n(5),half+.07);

  // Bit: clods over part of the teeth, towards the tip.
  const top=half+cut,bottom=design.doubleSided?-(half+cut*.9):-half;
  const bitY=(top+bottom)/2,bitRy=(top-bottom)/2+.04;
  const bit=[
    {kind:'bit',x:end-.2-.08*n(6),y:bitY,rx:.24,ry:bitRy},
    {kind:'bit',x:end-.48-.06*n(7),y:bitY+(n(8)-.5)*.08,rx:.14,ry:bitRy*.75},
  ];

  // Loose crumbs scattered over the metal.
  const spots=[[cx-hw*.5,cy+hh*.35],[cx+hw*.1,cy-hh*.7],[start+design.shaftLength*.12,-.02],
    [start+design.shaftLength*.55,.02],[cx-hw*.7,cy-hh*.2]];
  spots.forEach(([x,y],i)=>{
    const r=.045+.03*n(20+i);
    add('crumb',x+(n(30+i)-.5)*.1,y+(n(40+i)-.5)*.06,r,r*(.75+.3*n(50+i)));
  });
  if(design.broken) {
    const hinge=keyBreakX(template,design),angle=-keyBreakAngle(design)*Math.PI/180;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    for(const blob of [...bit,...blobs]) {
      if(blob.x<=hinge)continue;
      const dx=blob.x-hinge,radius=Math.max(blob.rx,blob.ry*.8);
      Object.assign(blob,{x:hinge+dx*cos-blob.y*sin,y:dx*sin+blob.y*cos,rx:radius,ry:radius});
    }
  }
  blobs.push(...bit);
  return blobs;
}

// Washing: clods soften and shrink from their edges, crumbs go first.
// `progressFor(blob)` is 0..1.
export function washMudBlobs(blobs,progressFor) {
  const result=[];
  for(const blob of blobs) {
    const e=Math.max(0,Math.min(1,progressFor(blob)*(blob.kind==='crumb'?1.8:1)));
    if(e>=1)continue;
    const shrink=1-e*e*(3-2*e);
    result.push({...blob,rx:blob.rx*(.2+.8*shrink),ry:blob.ry*(.2+.8*shrink)});
  }
  return result.filter(blob=>blob.rx>.016&&blob.ry>.016);
}

export function mudGeometry(template,design,{blobs=mudBlobLayout(template,design),heightScale=1}={}) {
  const seed=design.template*3.7+1.1;
  return coatGeometry(template,design,blobs,{bulge:BULGE,cell:CELL,heightScale,colors:MUD_COLORS,
    // Ragged, crumbly outline and a bumpy top.
    edge:(x,y)=>.16*(valueNoise(x*7.5,y*7.5,seed)-.5)+.07*(valueNoise(x*19,y*19,seed+5)-.5),
    relief:(x,y)=>.72+.5*valueNoise(x*9,y*9,seed+11)+.18*valueNoise(x*23,y*23,seed+17)});
}

let mudMaterial;
export function getMudMaterial() {
  if(!mudMaterial) mudMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,metalness:0,roughness:1,side:THREE.DoubleSide,flatShading:true,
  });
  return mudMaterial;
}

export function mudSvg(template,design) {
  if(!hasMud(design))return '';
  return coatSvg('mud',mudBlobLayout(template,design),MUD_COLORS,{shine:false});
}
