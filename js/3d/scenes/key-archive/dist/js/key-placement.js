import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES } from './key-data.js?v=plain-gouache';
import { holesFor, keyBounds } from './key-shapes.js';

// Model space: the blade points along +X, the painted front is +Z.
// Archive space: +Y is up. These anchors belong to the asset, not its preview.
export function getKeyAnchors(design) {
  const template=KEY_TEMPLATES[design?.template];
  if(!template)throw new RangeError('Unknown key design');
  const scale=design.headSize/100;
  const depth=design.thickness/100;
  const bounds=keyBounds(template,design);
  const holes=holesFor(template.bow).map(points=>points.map(([x,y])=>
    [-1.21+x*scale,y*scale]));
  // Twin-headed keys hang from the upper opening, not from the space between holes.
  const opening=holes.reduce((highest,points)=>
    Math.max(...points.map(p=>p[1]))>Math.max(...highest.map(p=>p[1]))?points:highest);
  const holeCenter=[opening.reduce((sum,p)=>sum+p[0],0)/opening.length,
    opening.reduce((sum,p)=>sum+p[1],0)/opening.length,depth/2];
  // Once the blade points down (-90° around Z), the hole's left edge becomes
  // its upper contact point in archive/world coordinates.
  const holeLeft=Math.min(...opening.map(p=>p[0]));
  const hang=[holeLeft+.012*scale,holeCenter[1],depth/2];
  const center=[(bounds.minX+bounds.maxX)/2,(bounds.minY+bounds.maxY)/2,depth/2];
  return {
    hang,holeCenter,center,
    floor:[center[0],center[1],0],
    bounds,
  };
}

function point3(value) {
  const point=Array.isArray(value)?value:[value?.x??0,value?.y??0,value?.z??0];
  if(point.length<3||point.some(v=>!Number.isFinite(v)))
    throw new TypeError('Placement position must contain three finite coordinates');
  return new THREE.Vector3(...point);
}

// Both presets map their chosen model-space anchor exactly onto world position.
// floor: the flat back touches a horizontal floor; hang: the blade points down.
export function createKeyPlacementMatrix(design,{mode='floor',position=[0,0,0],yaw=0,tilt=0}={}) {
  if(mode!=='floor'&&mode!=='hang')throw new RangeError('Unknown placement mode');
  if(!Number.isFinite(yaw)||!Number.isFinite(tilt))throw new TypeError('Invalid placement angles');
  const anchors=getKeyAnchors(design);
  const origin=new THREE.Vector3(...anchors[mode]);
  const rotation=new THREE.Matrix4().makeRotationY(yaw)
    .multiply(new THREE.Matrix4()[mode==='floor'?'makeRotationX':'makeRotationZ'](-Math.PI/2))
    .multiply(new THREE.Matrix4().makeRotationZ(tilt));
  const translation=point3(position).sub(origin.clone().applyMatrix4(rotation));
  return new THREE.Matrix4().makeTranslation(...translation.toArray()).multiply(rotation);
}
