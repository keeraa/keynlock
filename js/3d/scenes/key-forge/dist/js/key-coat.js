import * as THREE from '../vendor/three.js';
import { bowPoints, holesFor, bladeSections } from './key-shapes.js';

// Shared builder for soft coats stuck to a key (candle wax, lumps of mud).
// A coat is a set of ellipse "blobs" in the key's XY plane; the surface is a
// soft maximum of them, so neighbouring blobs melt into one another. The
// result is a closed shell hugging both faces of the key, never in the STL.

const THRESHOLD=.5;

function insidePolygon(x,y,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[i],[bx,by]=points[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}

export function metalTest(template,design) {
  const scale=design.headSize/100;
  const place=points=>points.map(([x,y])=>[x*scale-1.21,y*scale]);
  const head=place(bowPoints(template.bow)),holes=holesFor(template.bow).map(place);
  const blades=bladeSections(template,design);
  return (x,y)=>blades.some(points=>insidePolygon(x,y,points))||
    (insidePolygon(x,y,head)&&!holes.some(points=>insidePolygon(x,y,points)));
}

// A soft maximum (not a sum) of the blobs: neighbours melt together at their
// joins, but a row of overlapping blobs does not swell beyond its radii.
export function coatField(blobs,x,y) {
  let f=0;
  for(const b of blobs) {
    const dx=(x-b.x)/b.rx,dy=(y-b.y)/b.ry;
    const q=dx*dx+dy*dy;
    if(q<9)f+=Math.pow(2,-4*q);
  }
  return Math.pow(f,.25);
}

// Height profile: steep at the edge, rounded shoulder, flat on top.
function profile(f,plateau) {
  const t=Math.max(0,Math.min(1,(f-THRESHOLD)/(plateau-THRESHOLD)));
  return Math.sqrt(t*(2-t));
}

export function emptyCoatGeometry() {
  const empty=new THREE.BufferGeometry();
  for(const [name,size] of [['position',3],['normal',3],['uv',2],['color',3]])
    empty.setAttribute(name,new THREE.BufferAttribute(new Float32Array(0),size));
  return empty;
}

// Options:
//   bulge       how far the coat rises above each metal face
//   cell        surface grid size, in key units
//   plateau     field value where the top turns flat (flat tops use big quads)
//   heightScale shrinks the coat during an animation
//   edge(x,y)   optional field offset: a ragged outline (mud)
//   relief(x,y) optional height multiplier: a lumpy top (mud)
//   colors      {base,light,shade}
export function coatGeometry(template,design,blobs,{bulge,cell,plateau=.8,heightScale=1,
  edge=null,relief=null,colors}) {
  if(!blobs.length)return emptyCoatGeometry();
  const depth=design.thickness/100,mid=depth/2,lift=(mid+bulge)*heightScale;
  const field=(x,y)=>coatField(blobs,x,y)+(edge?edge(x,y):0);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const b of blobs) {
    minX=Math.min(minX,b.x-b.rx*1.3);maxX=Math.max(maxX,b.x+b.rx*1.3);
    minY=Math.min(minY,b.y-b.ry*1.3);maxY=Math.max(maxY,b.y+b.ry*1.3);
  }
  const CELL=cell;
  const cols=Math.ceil((maxX-minX)/CELL),rows=Math.ceil((maxY-minY)/CELL);
  const values=new Float32Array((cols+1)*(rows+1));
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++)
    values[r*(cols+1)+c]=field(minX+c*CELL,minY+r*CELL);

  // Pull grid points that lie outside the coat onto its edge, so the outline
  // follows the smooth field instead of the grid's staircase.
  const vertexIndex=new Int32Array((cols+1)*(rows+1)).fill(-1);
  const xy=[];
  const vertexFor=(c,r)=>{
    const id=r*(cols+1)+c;
    if(vertexIndex[id]>=0)return vertexIndex[id];
    let x=minX+c*CELL,y=minY+r*CELL;
    for(let step=0;step<4;step++) {
      const f=field(x,y);
      if(f>=THRESHOLD-1e-4)break;
      const e=CELL*.05;
      const gx=(field(x+e,y)-field(x-e,y))/(2*e);
      const gy=(field(x,y+e)-field(x,y-e))/(2*e);
      const g2=gx*gx+gy*gy;
      if(g2<1e-8)break;
      const move=Math.min(CELL,(THRESHOLD-f)/Math.sqrt(g2));
      x+=gx/Math.sqrt(g2)*move;y+=gy/Math.sqrt(g2)*move;
    }
    vertexIndex[id]=xy.length/2;
    xy.push(x,y);
    return vertexIndex[id];
  };
  const height=(x,y,f)=>lift*profile(f,plateau)*(relief?relief(x,y):1);
  const cells=[];
  const at=(c,r)=>values[r*(cols+1)+c];
  // A coat thinner than the metal is buried inside it and never seen.
  const insideMetal=metalTest(template,design);
  const buried=Math.max(0,(depth-.008)/2-.003);
  const hidden=new Uint8Array((cols+1)*(rows+1));
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++) {
    const x=minX+c*CELL,y=minY+r*CELL;
    hidden[r*(cols+1)+c]=height(x,y,at(c,r))<buried&&insideMetal(x,y);
  }
  // Greedy meshing of the flat top (only when the top really is flat).
  const used=new Uint8Array(cols*rows);
  if(!relief) {
    const flat=new Uint8Array(cols*rows);
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)
      flat[r*cols+c]=at(c,r)>=plateau&&at(c+1,r)>=plateau&&at(c+1,r+1)>=plateau&&at(c,r+1)>=plateau;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
      if(!flat[r*cols+c]||used[r*cols+c])continue;
      let width=1;
      while(c+width<cols&&flat[r*cols+c+width]&&!used[r*cols+c+width])width++;
      let tall=1;
      grow:while(r+tall<rows) {
        for(let k=0;k<width;k++)if(!flat[(r+tall)*cols+c+k]||used[(r+tall)*cols+c+k])break grow;
        tall++;
      }
      for(let rr=r;rr<r+tall;rr++)used.fill(1,rr*cols+c,rr*cols+c+width);
      const a=vertexFor(c,r),b=vertexFor(c+width,r),d=vertexFor(c+width,r+tall),e=vertexFor(c,r+tall);
      cells.push([a,b,d],[a,d,e]);
    }
  }
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
    if(used[r*cols+c])continue;
    const corners=[[c,r],[c+1,r],[c+1,r+1],[c,r+1]];
    if(!corners.some(([cc,rr])=>at(cc,rr)>THRESHOLD))continue;
    if(corners.every(([cc,rr])=>hidden[rr*(cols+1)+cc]))continue;
    const [a,b,d,e]=corners.map(([cc,rr])=>vertexFor(cc,rr));
    cells.push([a,b,d],[a,d,e]);
  }
  const count=xy.length/2;
  const positions=new Float32Array(count*2*3),uvs=new Float32Array(count*2*2);
  for(let i=0;i<count;i++) {
    const x=xy[i*2],y=xy[i*2+1],h=height(x,y,field(x,y));
    positions.set([x,y,mid+h],i*3);
    positions.set([x,y,mid-h],(i+count)*3);
    const uv=[(x-minX)/(maxX-minX),(y-minY)/(maxY-minY)];
    uvs.set(uv,i*2);uvs.set(uv,(i+count)*2);
  }
  const index=[];
  for(const [a,b,c] of cells) index.push(a,b,c,c+count,b+count,a+count);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  // Painted light on the faces, shade towards the rim and underside.
  const normal=geometry.getAttribute('normal');
  const vertexColors=new Float32Array(normal.count*3);
  const base=new THREE.Color(colors.base),light=new THREE.Color(colors.light);
  const shade=new THREE.Color(colors.shade),color=new THREE.Color();
  for(let i=0;i<normal.count;i++) {
    const facing=Math.abs(normal.getZ(i)),up=normal.getY(i);
    if(facing>.82)color.copy(base).lerp(light,(facing-.82)/.18*.9);
    else color.copy(base).lerp(shade,Math.min(1,(.82-facing)*.9+Math.max(0,-up)*.4));
    vertexColors.set([color.r,color.g,color.b],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(vertexColors,3));
  return geometry;
}

export function ellipsePath(b,grow=0) {
  const rx=b.rx+grow,ry=b.ry+grow;
  return `M ${(b.x-rx).toFixed(3)} ${(-b.y).toFixed(3)} a ${rx.toFixed(3)} ${ry.toFixed(3)} 0 1 0 ${(2*rx).toFixed(3)} 0 a ${rx.toFixed(3)} ${ry.toFixed(3)} 0 1 0 ${(-2*rx).toFixed(3)} 0 Z`;
}

// Flat preview: ink every blob first, then fill them all on top, so only the
// outer outline of the merged coat remains.
export function coatSvg(className,blobs,colors,{shine=true}={}) {
  const shapes=blobs.map(b=>({...b,rx:b.rx*.82,ry:b.ry*.82}));
  const ink=shapes.map(b=>`<path d="${ellipsePath(b,.022)}" fill="${colors.ink}"/>`).join('');
  const fill=shapes.map(b=>`<path d="${ellipsePath(b)}" fill="${colors.base}"/>`).join('');
  const highlights=shine?shapes.filter(b=>b.kind!=='run'&&b.kind!=='crumb').map(b=>
    `<path d="${ellipsePath({x:b.x-b.rx*.2,y:b.y+b.ry*.25,rx:b.rx*.4,ry:b.ry*.28})}" fill="${colors.light}"/>`).join(''):'';
  return `<g class="${className}">${ink}${fill}${highlights}</g>`;
}
