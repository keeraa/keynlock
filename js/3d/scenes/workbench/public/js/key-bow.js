// A punched, rounded key bow with a short shoulder and a stamped maker's mark.
// The shaft remains in the same coordinates as the editable blade.
import {BLADE_LEFT,KEY_TOP_Y,KEY_BOTTOM_Y} from './logic.js';
import {KEY_BLADE_DEPTH,KEY_BLADE_OFFSET_Z} from './key-blade.js';

export const BOW_CENTER_X=-2.12;
export const BOW_CENTER_Y=(KEY_TOP_Y+KEY_BOTTOM_Y)/2;
const BOW_RADIUS=.46;
const HOLE_RADIUS=.128;

export function createKeyBowShape(THREE){
  const outline=new THREE.Shape();
  const angle=Math.asin((KEY_TOP_Y-BOW_CENTER_Y)/BOW_RADIUS);
  const neckX=BOW_CENTER_X+Math.cos(angle)*BOW_RADIUS;
  outline.moveTo(BLADE_LEFT,KEY_TOP_Y);
  outline.lineTo(neckX,KEY_TOP_Y);
  // A true circular arc makes the head and the aperture concentric. Its
  // missing right-hand segment becomes the short straight key shoulder.
  outline.absarc(BOW_CENTER_X,BOW_CENTER_Y,BOW_RADIUS,
    angle,Math.PI*2-angle,false);
  outline.lineTo(BLADE_LEFT,KEY_BOTTOM_Y);outline.closePath();
  const hole=new THREE.Path();
  hole.absarc(BOW_CENTER_X,BOW_CENTER_Y,HOLE_RADIUS,0,Math.PI*2,true);
  outline.holes.push(hole);
  return outline;
}

export function createKeyBow(THREE,parent,metal,rimMaterial){
  const group=new THREE.Group();parent.add(group);
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(createKeyBowShape(THREE),{
    // No bevel on the common neck end: it joins the blade flush without the
    // bright vertical seam left by two overlapping chamfered solids.
    depth:KEY_BLADE_DEPTH,bevelEnabled:false,curveSegments:48,steps:1
  }),metal);
  body.position.z=KEY_BLADE_OFFSET_Z;body.castShadow=true;body.receiveShadow=true;group.add(body);

  const trim=new THREE.Mesh(new THREE.TorusGeometry(HOLE_RADIUS,.006,7,48),rimMaterial);
  trim.position.set(BOW_CENTER_X,BOW_CENTER_Y,KEY_BLADE_OFFSET_Z+KEY_BLADE_DEPTH+.002);
  trim.castShadow=false;group.add(trim);
  const backTrim=trim.clone();backTrim.position.z=KEY_BLADE_OFFSET_Z-.002;group.add(backTrim);

  const engraving=document.createElement('canvas');engraving.width=256;engraving.height=128;
  const ctx=engraving.getContext('2d');
  ctx.strokeStyle='rgba(95,60,26,.92)';ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(23,22);ctx.lineTo(233,22);ctx.lineTo(222,104);
  ctx.lineTo(34,104);ctx.closePath();ctx.stroke();
  ctx.strokeStyle='rgba(247,219,161,.74)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(35,30);ctx.lineTo(221,30);ctx.stroke();
  ctx.font='bold 68px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(96,58,24,.96)';ctx.fillText('K',128,67);
  const stampTexture=new THREE.CanvasTexture(engraving);
  stampTexture.colorSpace=THREE.SRGBColorSpace;
  const stampMaterial=new THREE.MeshBasicMaterial({map:stampTexture,transparent:true,
    opacity:.82,depthWrite:false,side:THREE.DoubleSide});
  const stampGeometry=new THREE.PlaneGeometry(.26,.13);
  const front=new THREE.Mesh(stampGeometry,stampMaterial);
  front.position.set(-1.824,-.17,KEY_BLADE_OFFSET_Z+KEY_BLADE_DEPTH+.0015);
  front.renderOrder=8;group.add(front);
  const back=front.clone();back.position.z=KEY_BLADE_OFFSET_Z-.0015;
  back.rotation.y=Math.PI;group.add(back);

  return {group,dispose:()=>{
    group.remove(body,trim,backTrim,front,back);parent.remove(group);
    body.geometry.dispose();trim.geometry.dispose();backTrim.geometry.dispose();
    stampGeometry.dispose();stampMaterial.dispose();stampTexture.dispose();
  }};
}
