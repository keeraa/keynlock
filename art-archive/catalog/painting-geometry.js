// Engine-independent physical contract shared by drawing, picking and collisions.
export function paintingSize(painting,heightM=null){
 const size=painting.physicalSizeM;
 const height=heightM??size?.height??.9;
 return {width:heightM===null&&size?size.width:height*painting.image.widthPx/painting.image.heightPx,height};
}
export function frameDimensions(slot,settings){
 return {width:slot.width??slot.painting.physicalSizeM.width+2*settings.frameWidthM,
  height:(slot.height??slot.painting.physicalSizeM.height)+2*settings.frameWidthM,depth:slot.depth??settings.frameDepthM};
}
export function frameOrientation(slot){
 const floor=Number.isFinite(slot.floorAngle)&&!slot.trolley;
 const yaw=floor?slot.floorAngle:Math.atan2(slot.normal.x,slot.normal.z);
 const pitch=floor?(slot.faceDown?Math.PI/2:-Math.PI/2):slot.leanPitch??0;
 return {floor,yaw,c:Math.cos(yaw),s:Math.sin(yaw),pitch,cp:Math.cos(pitch),sp:Math.sin(pitch)};
}
export const mountedFrame=slot=>slot.floorAngle===undefined&&!slot.trolley&&!slot.leanPitch;
export function frameFootprint(slot,settings){
 const {width,height,depth}=frameDimensions(slot,settings),{c,s,cp,sp}=frameOrientation(slot);
 return {x:slot.x,z:slot.z,u:{x:c,z:-s},v:{x:s,z:c},w:width/2,h:(Math.abs(sp)*height+Math.abs(cp)*depth)/2};
}
export function footprintExtent(r,n){return r.w*Math.abs(r.u.x*n.x+r.u.z*n.z)+r.h*Math.abs(r.v.x*n.x+r.v.z*n.z);}
export function footprintCorners(r){return [-1,1].flatMap(i=>[-1,1].map(j=>({x:r.x+i*r.w*r.u.x+j*r.h*r.v.x,z:r.z+i*r.w*r.u.z+j*r.h*r.v.z})));}
export function footprintsOverlap(a,b,gap=0){
 return [a.u,a.v,b.u,b.v].every(n=>Math.abs((a.x-b.x)*n.x+(a.z-b.z)*n.z)<footprintExtent(a,n)+footprintExtent(b,n)+gap-.0001);
}


// Share the outer silhouette between the detailed frame, atlas, and wall imprint.
export function frameCornerCut(width,height,rim){
 return Math.min(.015,rim*.25,width*.028,height*.028);
}
export function clippedFrameCorners(x,y,cut){
 return [[-x+cut,-y],[x-cut,-y],[x,-y+cut],[x,y-cut],
  [x-cut,y],[-x+cut,y],[-x,y-cut],[-x,-y+cut]];
}
