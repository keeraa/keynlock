import { KEY_TEMPLATES, METALS, defaultDesign, RUST_TEXTURE, keyAssetUrl, fixedMetal } from './key-data.js';
import { bowPoints, holesFor, bladeSections,
  keyBounds, shaftStartX } from './key-shapes.js';
import { waxSvg } from './key-wax.js';
import { mudSvg } from './key-mud.js';

function svgPath(points) {
  return `M ${points.map(([x,y])=>`${x.toFixed(3)} ${(-y).toFixed(3)}`).join(' L ')} Z`;
}

function svgBladeOutline(template,design,sections) { return svgPath(sections[0]); }

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
  const mudLayer=mudSvg(t,design);
  const waxLayer=waxSvg(t,design);
  const rustOffsetX=(-2.35+design.template*.13).toFixed(2);
  const rustOffsetY=(-1.62+design.template*.09).toFixed(2);
  const rustRotation=(design.template*29-19)%67;
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
      <path d="${bodyPath}" fill="url(#keypaint)"/><path d="${bowPath}" fill="url(#keypaint)" fill-rule="evenodd"/>
      <path d="${bodyPath}" fill="${metal.color}" fill-opacity="${['mercury','tin','lead','silver'].includes(metal.id)?'.42':'.1'}"/><path d="${bowPath}" fill="${metal.color}" fill-opacity="${['mercury','tin','lead','silver'].includes(metal.id)?'.42':'.1'}" fill-rule="evenodd"/>
      ${rustLayer}
      <path d="${svgBladeOutline(t,design,shafts)}" fill="none" stroke="${stroke}" stroke-width=".035"/><path d="${bowPath}" fill="none" stroke="${stroke}" stroke-width=".035"/>
      ${mudLayer}${waxLayer}
    </g>
  </svg>`;
}
