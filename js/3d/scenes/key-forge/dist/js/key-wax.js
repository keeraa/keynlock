import * as THREE from '../vendor/three.js';
import { bowPoints, shaftStartX, shaftHalfHeight, keyBreakX, keyBreakAngle } from './key-shapes.js';
import { coatGeometry, coatSvg } from './key-coat.js';
import { stableNoise } from './key-dirt.js';

// Candle wax as a thick, smooth coat: the whole bit (teeth included) is sunk
// in wax, the lower rim of the bow and a collar on the shaft are coated too.
// The coat is one continuous soft surface built from a 2D "metaball" field,
// so overlapping pools melt into each other with no seams or loose drops.
// Wax is decorative and never enters the STL.

export const WAX_COLORS=Object.freeze({base:'#d9bf8a',light:'#eddcb4',shade:'#b08c50',ink:'#6f5129'});
const BULGE=.035;      // how far the wax rises above the metal face
const CELL=.07;       // surface grid size, in key units

export function hasWax(design) {
  return (design.waxAmount??0)>0;
}

// Blobs are ellipses in the key's XY plane. A single blob's coat ends exactly
// at its rx/ry radius; neighbouring blobs merge smoothly.
export function waxBlobLayout(template,design) {
  const scale=design.headSize/100;
  const seed=design.template*7.13+1.7;
  const n=i=>stableNoise(seed+i*3.31);
  const head=bowPoints(template.bow).map(([x,y])=>[x*scale-1.21,y*scale]);
  const minX=Math.min(...head.map(p=>p[0])),maxX=Math.max(...head.map(p=>p[0]));
  const minY=Math.min(...head.map(p=>p[1])),maxY=Math.max(...head.map(p=>p[1]));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,hw=(maxX-minX)/2,hh=(maxY-minY)/2;
  const start=shaftStartX(template,design),end=start+design.shaftLength;
  const half=shaftHalfHeight(template),cut=design.cutDepth/100;
  const blobs=[];
  const add=(kind,x,y,rx,ry)=>blobs.push({kind,x,y,rx,ry});

  // Bow: three overlapping pools along the lower rim, plus a run below.
  for(const [i,angle] of [-2.35,-1.75,-1.15].entries()) {
    const a=angle+.18*(n(i+1)-.5);
    add('bow',cx+Math.cos(a)*hw*.78,cy+Math.sin(a)*hh*.78,(.25+.06*n(i+4))*scale,(.2+.05*n(i+7))*scale);
  }
  add('run',cx+hw*.05*(n(10)-.5),minY-.02,.075*scale,.14*scale);

  // Shaft collar with a short run hanging off its lower edge.
  const collar=start+design.shaftLength*(design.broken?.18:.25+.08*n(11));
  add('shaft',collar,0,.22,half+.085);
  add('shaft',collar+.17,.01,.17,half+.07);
  add('run',collar+.06+.08*(n(12)-.5),-(half+.06),.065,.13);

  // Bit: the whole toothed part is sunk in wax.
  const trigger=template.blade==='serrated'?.32:.60;
  const bitStart=start+design.shaftLength*trigger-.05;
  const top=half+cut,bottom=design.doubleSided?-(half+cut*.9):-half;
  const bitY=(top+bottom)/2,bitRy=(top-bottom)/2+.05;
  const count=Math.max(3,Math.ceil((end-bitStart)/.2));
  const bit=[];
  for(let i=0;i<count;i++) {
    const t=count===1?.5:i/(count-1);
    bit.push({kind:'bit',x:bitStart+.04+(end-bitStart-.02)*t,y:bitY+.02*(n(i+20)-.5),
      rx:.19+.03*n(i+30),ry:bitRy});
  }
  bit.push({kind:'run',x:bitStart+(end-bitStart)*(.35+.3*n(40)),y:bottom-.07,rx:.07,ry:.14});
  if(design.broken) {
    // The toothed part is bent around the break; bend the wax with it.
    const hinge=keyBreakX(template,design),angle=-keyBreakAngle(design)*Math.PI/180;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    for(const blob of bit) {
      if(blob.x<=hinge)continue;
      const dx=blob.x-hinge,radius=Math.max(blob.rx,blob.ry*.8);
      Object.assign(blob,{x:hinge+dx*cos-blob.y*sin,y:dx*sin+blob.y*cos,rx:radius,ry:radius});
    }
  }
  blobs.push(...bit);
  return blobs;
}

// Melting over a candle: each pool shrinks and sags once the heat reaches it;
// runs first stretch downwards, then thin out. `progressFor(blob)` is 0..1.
// `sag:false` when the key lies flat: wax then shrinks in place and drips
// straight down off the underside instead of sliding along the key.
export function meltWaxBlobs(blobs,progressFor,{sag=true}={}) {
  const result=[];
  for(const blob of blobs) {
    const e=Math.max(0,Math.min(1,progressFor(blob)));
    if(e>=1)continue;
    if(blob.kind==='run'&&sag) {
      const stretch=1+1.1*Math.min(e,.6)/.6;
      const thin=e>.6?1-(e-.6)/.4:1;
      const ry=blob.ry*stretch*Math.max(.35,thin);
      result.push({...blob,rx:blob.rx*(.6+.4*thin),ry,y:blob.y-(ry-blob.ry)*.9});
    } else {
      const shrink=1-e*e*(3-2*e);
      result.push({...blob,rx:blob.rx*(.15+.85*shrink),ry:blob.ry*(.15+.85*shrink),
        y:blob.y-(sag?blob.ry*.35*e:0)});
    }
  }
  return result.filter(blob=>blob.rx>.018&&blob.ry>.018);
}

// `blobs` and `heightScale` let the melt animation rebuild a thinning coat.
export function waxGeometry(template,design,{blobs=waxBlobLayout(template,design),heightScale=1}={}) {
  return coatGeometry(template,design,blobs,{bulge:BULGE,cell:CELL,heightScale,colors:WAX_COLORS});
}

let waxMaterial;
export function getWaxMaterial() {
  if(!waxMaterial) waxMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,metalness:0,roughness:.55,side:THREE.DoubleSide,
    emissive:new THREE.Color('#5a3a12'),emissiveIntensity:.16,
  });
  return waxMaterial;
}

export function waxSvg(template,design) {
  if(!hasWax(design))return '';
  return coatSvg('wax',waxBlobLayout(template,design),WAX_COLORS);
}
