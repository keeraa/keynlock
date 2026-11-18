import { KEY_TEMPLATES, METALS, defaultDesign, RUST_TEXTURE, keyAssetUrl, fixedMetal } from './key-data.js';
import { bowPoints, holesFor, bladeSections, keyBreakX, keyBreakAngle,
  keyBounds, shaftStartX, shaftHalfHeight } from './key-shapes.js';
import { keyMarkings, markPigment } from './key-markings.js';
import { dirtPaint, stableNoise, crustWidth, dirtSections, dirtSegments } from './key-dirt.js';

function svgPath(points) {
  return `M ${points.map(([x,y])=>`${x.toFixed(3)} ${(-y).toFixed(3)}`).join(' L ')} Z`;
}

// Do not outline both end caps at the fracture: two dark rectangles there look
// like overlapping parts. Only the visible outer edges receive ink.
function svgBladeOutline(template,design,sections) {
  if(!design.broken)return svgPath(sections[0]);
  const hinge=keyBreakX(template,design),angle=-keyBreakAngle(design)*Math.PI/180;
  const paths=[];
  for(const [part,points] of sections.entries()) {
    const originalX=point=>part===0?point[0]:
      hinge+Math.cos(angle)*(point[0]-hinge)+Math.sin(angle)*point[1];
    let path='',penUp=true;
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      const seam=Math.abs(originalX(a)-hinge)<.0001&&Math.abs(originalX(b)-hinge)<.0001;
      if(seam){penUp=true;continue;}
      if(penUp)path+=`M ${a[0].toFixed(3)} ${(-a[1]).toFixed(3)} `;
      path+=`L ${b[0].toFixed(3)} ${(-b[1]).toFixed(3)} `;
      penUp=false;
    }
    paths.push(path);
  }
  return paths.join(' ');
}

function svgDirtCrust(template,design) {
  const width=crustWidth(design);
  if(!width)return '';
  const neck=shaftStartX(template,design),half=shaftHalfHeight(template);
  const paths=dirtPaint.map(()=>[]);
  const inkEdges=[];
  for(const section of dirtSections(template,design)) {
    const {ring,segments}=dirtSegments(section,width,neck,half);
    for(const [i,j] of segments) {
      const shade=Math.floor(stableNoise(i*4.1+section.seed*17)*3);
      paths[shade].push(svgPath([ring.outer[i],ring.outer[j],ring.inner[j],ring.inner[i]]));
      const a=ring.outer[i],b=ring.outer[j];
      inkEdges.push(`M ${a[0].toFixed(3)} ${(-a[1]).toFixed(3)} L ${b[0].toFixed(3)} ${(-b[1]).toFixed(3)}`);
    }
  }
  return `<g class="dirt-crust">${paths.map((path,i)=>
    `<path d="${path.join(' ')}" fill="${dirtPaint[i]}"/>`).join('')}
    <path d="${inkEdges.join(' ')}" fill="none" stroke="#332a23" stroke-width=".031" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

function pointInsidePolygon([x,y],points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[i], [bx,by]=points[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}

function distanceFromPolygon([x,y],points) {
  let smallest=Infinity;
  for(let i=0;i<points.length;i++) {
    const [ax,ay]=points[i], [bx,by]=points[(i+1)%points.length];
    const dx=bx-ax,dy=by-ay,divisor=dx*dx+dy*dy;
    const t=divisor?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/divisor)):0;
    smallest=Math.min(smallest,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  return smallest;
}

// Keep candidate positions/edge distances when only the amount of dirt,
// metal or rust changes. The deterministic silhouettes and flecks stay exact.
const dirtLayouts=new Map();
const dirtLayerMarkup=new Map();
const dirtFleckColors=['#3c3024','#55412c','#69523a','#80684b'];
function dirtShapeSignature(design) {
  return [design.template,design.headSize,design.shaftLength,design.teeth,
    design.cutDepth,Number(!!design.doubleSided),Number(!!design.broken),
    design.broken?(design.breakAngle??70):0].join(':');
}

function limitCache(cache,maxEntries) {
  if(cache.size>maxEntries)cache.delete(cache.keys().next().value);
}

function dirtCandidate(layout,shaft,head,holes) {
  const attempt=layout.attempt++;
  const {seed,minX,maxX,minY,maxY}=layout;
  const x=minX+stableNoise(seed+attempt*8.71)*(maxX-minX);
  const y=minY+stableNoise(seed+attempt*12.43+19.3)*(maxY-minY);
  const point=[x,y];
  const inHead=pointInsidePolygon(point,head)&&!holes.some(h=>pointInsidePolygon(point,h));
  const inShaft=shaft.some(shape=>pointInsidePolygon(point,shape));
  if(!inHead&&!inShaft)return;
  const headRoom=inHead?Math.min(distanceFromPolygon(point,head),...holes.map(h=>distanceFromPolygon(point,h))):0;
  const shaftRoom=inShaft?Math.max(...shaft.filter(shape=>pointInsidePolygon(point,shape)).map(shape=>distanceFromPolygon(point,shape))):0;
  layout.candidates.push({attempt,x,y,room:Math.max(headRoom,shaftRoom)*.81,
    size:.62+1.04*stableNoise(seed+attempt*6.29+31.7),
    roughness:Array.from({length:11},(_,j)=>.68+.29*stableNoise(seed+attempt*19.23+j*13.17)),
    shade:Math.floor(stableNoise(seed+attempt*17.91+77.1)*dirtFleckColors.length)});
}

// Each opaque gouache fleck is contained within a metal polygon. Using the
// actual silhouette avoids browser-specific SVG clipping/pattern failures.
function svgDirtCoat(template,design,bodyPath,bowPath,shaft,head,holes) {
  const strength=Math.max(0,Math.min(100,design.dirtAmount??0))/100;
  if(strength<=0)return '';
  const patches=dirtFleckColors.map(()=>[]);
  const count=Math.round(80+210*strength);
  const signature=dirtShapeSignature(design);
  let layout=dirtLayouts.get(signature);
  if(!layout) {
    const bounds=keyBounds(template,design);
    layout={attempt:0,candidates:[],seed:design.template*197.13+9.37,
      minX:bounds.minX-.09,maxX:bounds.maxX+.09,
      minY:bounds.minY-.09,maxY:bounds.maxY+.09};
    dirtLayouts.set(signature,layout);limitCache(dirtLayouts,12);
  }
  let accepted=0,candidateIndex=0;
  while(accepted<count) {
    while(candidateIndex>=layout.candidates.length&&layout.attempt<count*25)
      dirtCandidate(layout,shaft,head,holes);
    const candidate=layout.candidates[candidateIndex++];
    if(!candidate||candidate.attempt>=count*25)break;
    const radius=Math.min((.044+.155*strength)*candidate.size,candidate.room);
    if(radius<.008)continue;
    const points=Array.from({length:11},(_,j)=>{
      const angle=j*Math.PI*2/11;
      const roughness=candidate.roughness[j];
      return [candidate.x+Math.cos(angle)*radius*roughness,candidate.y+Math.sin(angle)*radius*roughness];
    });
    patches[candidate.shade].push(svgPath(points));
    accepted++;
  }
  const base=strength>=.995?
    `<path d="${bodyPath}" fill="#55412d"/><path d="${bowPath}" fill="#55412d" fill-rule="evenodd"/>`:'';
  const paint=patches.map((paths,i)=>`<path d="${paths.join(' ')}" fill="${dirtFleckColors[i]}"/>`).join('');
  return `<g class="dirt-coat">${base}${paint}</g>`;
}

export function keyIconSvg(index,{collected=false,design=defaultDesign(index)}={}) {
  const template=KEY_TEMPLATES[index];
  const scale=design.headSize/100;
  const head=bowPoints(template.bow).map(([x,y])=>[x*scale-1.21,y*scale]);
  const holes=holesFor(template.bow).map(points=>points.map(([x,y])=>[x*scale-1.21,y*scale]));
  const shaft=bladeSections(template,design,60);
  const fill=collected?'#d6b77a':'#a5a99b';
  const lines=collected?'#6d5739':'#536358';
  const bounds=keyBounds(template,design);
  const left=Math.min(-2,bounds.minX-.15),right=Math.max(2.05,bounds.maxX+.12);
  const top=Math.max(1.15,bounds.maxY+.12),bottom=Math.min(-1.15,bounds.minY-.12);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left.toFixed(2)} ${(-top).toFixed(2)} ${(right-left).toFixed(2)} ${(top-bottom).toFixed(2)}" aria-hidden="true"><g fill="${fill}" stroke="${lines}" stroke-width=".025" stroke-linejoin="round">${shaft.map(p=>`<path d="${svgPath(p)}"/>`).join('')}<path d="${svgPath(head)} ${holes.map(svgPath).join(' ')}" fill-rule="evenodd"/></g></svg>`;
}

// A faithful silhouette preview for devices where the browser disables WebGL.
// Uses the same bow and cut profiles as the extruded 3D object.
export function keyPreviewSvg(design) {
  const t=KEY_TEMPLATES[design.template];
  const metal=METALS.find(m=>m.id===fixedMetal(design.template))||METALS[0];
  const scale=design.headSize/100;
  const head=bowPoints(t.bow).map(([x,y])=>[x*scale-1.21,y*scale]);
  const holes=holesFor(t.bow).map(p=>p.map(([x,y])=>[x*scale-1.21,y*scale]));
  const shafts=bladeSections(t,design,200);
  const bodyPath=shafts.map(svgPath).join(' '),bowPath=`${svgPath(head)} ${holes.map(svgPath).join(' ')}`;
  const stroke='#332a23';
  const right=Math.max(2.3,shaftStartX(t,design)+design.shaftLength+.35);
  const rustStrength=Math.max(0,Math.min(200,design.rustAmount??0))/100;
  const rustOpacity=Math.min(1,rustStrength);
  const rustDeepen=Math.max(0,rustStrength-1);
  const rustPaths=`<path d="${bodyPath}" fill="url(#keyrust)"/><path d="${bowPath}" fill="url(#keyrust)" fill-rule="evenodd"/>`;
  const rustLayer=rustOpacity>0?
    `<g opacity="${rustOpacity.toFixed(2)}">${rustPaths}</g>${rustDeepen>0?`<g opacity="${(rustDeepen*.7).toFixed(2)}" style="mix-blend-mode:multiply">${rustPaths}</g>`:''}`:'';
  const dirtSignature=`${dirtShapeSignature(design)}:${design.dirtAmount??0}`;
  let dirtLayers=dirtLayerMarkup.get(dirtSignature);
  if(!dirtLayers) {
    dirtLayers=[svgDirtCrust(t,design),svgDirtCoat(t,design,bodyPath,bowPath,shafts,head,holes)];
    dirtLayerMarkup.set(dirtSignature,dirtLayers);limitCache(dirtLayerMarkup,24);
  }
  const [dirtLayer,dirtCoat]=dirtLayers;
  const rustOffsetX=(-2.35+design.template*.13).toFixed(2);
  const rustOffsetY=(-1.62+design.template*.09).toFixed(2);
  const rustRotation=(design.template*29-19)%67;
  const marks=keyMarkings(t,design).map(mark=>`<ellipse cx="${mark.x.toFixed(3)}" cy="${(-mark.y).toFixed(3)}" rx="${mark.rx.toFixed(3)}" ry="${mark.ry.toFixed(3)}" fill="${markPigment(metal.id)}" opacity=".96"/>`).join('');
  const bounds=keyBounds(t,design);
  const left=Math.min(-2.15,bounds.minX-.25),rightEdge=Math.max(right,bounds.maxX+.35);
  const top=Math.max(1.18,bounds.maxY+.25),bottom=Math.min(-1.18,bounds.minY-.25);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left.toFixed(3)} ${(-top).toFixed(3)} ${(rightEdge-left).toFixed(3)} ${(top-bottom).toFixed(3)}" aria-label="Нарисованный ключ ${t.name}" role="img">
    <defs>
      <pattern id="keypaint" patternUnits="userSpaceOnUse" x="-2" y="-1" width="2.3" height="2.3"><image href="${keyAssetUrl(metal.file)}" width="2.3" height="2.3" preserveAspectRatio="xMidYMid slice"/></pattern>
      <pattern id="keyrust" patternUnits="userSpaceOnUse" x="${rustOffsetX}" y="${rustOffsetY}" width="2.8" height="2.8" patternTransform="rotate(${rustRotation})"><image href="${keyAssetUrl(RUST_TEXTURE)}" width="2.8" height="2.8" preserveAspectRatio="xMidYMid slice"/></pattern>
      <filter id="keydrop" x="-30%" y="-40%" width="160%" height="180%"><feDropShadow dx=".08" dy=".15" stdDeviation=".07" flood-color="#5c391d" flood-opacity=".45"/></filter>
    </defs>
    <g transform="rotate(-4 0 0)" filter="url(#keydrop)" stroke-linejoin="round">
      ${dirtLayer}
      <path d="${bodyPath}" fill="url(#keypaint)"/><path d="${bowPath}" fill="url(#keypaint)" fill-rule="evenodd"/>
      <path d="${bodyPath}" fill="${metal.color}" fill-opacity="${['mercury','tin','lead','silver'].includes(metal.id)?'.42':'.1'}"/><path d="${bowPath}" fill="${metal.color}" fill-opacity="${['mercury','tin','lead','silver'].includes(metal.id)?'.42':'.1'}" fill-rule="evenodd"/>
      ${rustLayer}<g opacity=".9">${marks}</g>${dirtCoat}
      ${design.dirtAmount>0?'':`<path d="${svgBladeOutline(t,design,shafts)}" fill="none" stroke="${stroke}" stroke-width=".035"/><path d="${bowPath}" fill="none" stroke="${stroke}" stroke-width=".035"/>`}
    </g>
  </svg>`;
}
