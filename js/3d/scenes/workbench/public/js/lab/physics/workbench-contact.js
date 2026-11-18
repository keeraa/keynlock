// Shared geometric contacts for the lock tools and the removable hardware.
// Coordinates are in laboratory-lock local space, before the host scene scales it.
export const TABLE_Z=.08;

export const SORTING_TRAY=Object.freeze({
  x:-5.4,y:1.95,width:1.07*1.5,height:.76*1.5,
  wall:.09/2,wallHeight:.37*2,
  bottomCenter:-.105,bottomThickness:.075
});
export const SECOND_SORTING_TRAY=Object.freeze({...SORTING_TRAY,x:-3.48});

export function createWorkbenchContact({screws,isCoverAttached,tableSurfaceZ=TABLE_Z,
  lockScale=1,lockCenterX=0,lockCenterY=0,lockTopZ=.77}){
  function surfaceAt(x,y){
    const localX=x-lockCenterX,localY=y-lockCenterY;
    if(Math.abs(localX)<1.90*lockScale&&Math.abs(localY)<1.47*lockScale){
      for(const screw of screws){
        if(!screw.userData.removed&&Math.hypot(x-screw.position.x,y-screw.position.y)<.23*lockScale)
          return lockTopZ+.13*lockScale;
      }
      if(Math.abs(localX)>1.62*lockScale||Math.abs(localY)>1.18*lockScale)
        return Number((lockTopZ+.05*lockScale).toFixed(5));
    }
    if(isCoverAttached()&&Math.abs(localX)<1.64*lockScale&&
      Math.abs(localY)<1.19*lockScale)return lockTopZ;
    if(Math.abs(localX)<1.63*lockScale&&Math.abs(localY)<1.2*lockScale)
      return Number((lockTopZ-.04*lockScale).toFixed(5));
    return tableSurfaceZ+.11;
  }

  // A long tool must clear the whole projected shaft, not only its origin.
  function driverClearance(x,y,angle=0,scale=1){
    const dx=Math.cos(angle)*scale,dy=Math.sin(angle)*scale;
    return Math.max(...[-.38,0,.45,1.2].map(distance=>
      surfaceAt(x+distance*dx,y+distance*dy)))+.17*scale;
  }

  return {surfaceAt,driverClearance};
}

export function createTrayContact({x,y,width,height,wall}){
  const bounds={x,y,w:width-2*wall,h:height-2*wall};
  const contains=(pointX,pointY)=>Math.abs(pointX-x)<bounds.w/2&&
    Math.abs(pointY-y)<bounds.h/2;
  const clamp=(point)=>{
    const xMin=x-bounds.w/2,xMax=x+bounds.w/2;
    const yMin=y-bounds.h/2,yMax=y+bounds.h/2;
    return {x:Math.max(xMin,Math.min(xMax,point.x)),
      y:Math.max(yMin,Math.min(yMax,point.y))};
  };
  return {bounds,contains,clamp};
}

// The driver is built along +X. A positive Y rotation points its bit down
// along -Z; its far tip must meet the top of the screw head.
export function screwdriverDockPose(screwPosition,shaftLength=1.29){
  return {x:screwPosition.x,y:screwPosition.y,
    z:screwPosition.z+shaftLength+.096,rotationY:Math.PI/2};
}

// In the player's hand the handle faces the viewer and the bit points away.
// Use the live camera position, including when free camera mode is enabled.
export function screwdriverGripAngle(toolPosition,viewerPosition){
  return Math.atan2(toolPosition.y-viewerPosition.y,
    toolPosition.x-viewerPosition.x);
}

// Solve the handle position analytically: the rotating bit's far tip lands
// exactly under the mouse cursor, at any angle of the overhead camera.
export function screwdriverHandleForTip(tip,viewer,shaftLength=1.29){
  const dx=tip.x-viewer.x,dy=tip.y-viewer.y;
  const length=Math.hypot(dx,dy)||1;
  const angle=Math.atan2(dy,dx);
  return {x:tip.x-shaftLength*dx/length,
    y:tip.y-shaftLength*dy/length,angle};
}
