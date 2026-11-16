// Distance-based LOD for generated districts. A small hysteresis band prevents
// houses from constantly rebuilding while the orbit camera drifts near a limit.
export const HOUSE_LOD_BANDS=Object.freeze({highIn:32,highOut:40,mediumIn:83,mediumOut:99});

// World-distance bands for a continuous crossfade. The next LOD is prepared
// well before its first pixel becomes visible, avoiding geometry rebuilds at
// the exact zoom threshold.
export const HOUSE_LOD_BLEND=Object.freeze({
  highFull:29,highGone:48,mediumFull:76,mediumGone:112,
  preloadHigh:68,releaseHigh:77,preloadMedium:142,releaseMedium:158,
});

const smooth=(t)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};

export function houseLODWeights(distance,selected=false){
  if(selected)return {low:0,medium:0,high:1};
  const d=Math.max(0,distance);
  const b=HOUSE_LOD_BLEND;
  if(d<=b.highFull)return {low:0,medium:0,high:1};
  if(d<b.highGone){
    const high=smooth((b.highGone-d)/(b.highGone-b.highFull));
    return {low:0,medium:1-high,high};
  }
  if(d<=b.mediumFull)return {low:0,medium:1,high:0};
  if(d<b.mediumGone){
    const medium=smooth((b.mediumGone-d)/(b.mediumGone-b.mediumFull));
    return {low:1-medium,medium,high:0};
  }
  return {low:1,medium:0,high:0};
}

export function houseCameraDistance(camera,house) {
  const height=(house.config.floors*house.config.floorHeight+house.config.roofHeight)*.5;
  return Math.hypot(camera.x-house.x,camera.y-height,camera.z-house.z);
}

export function chooseQuarterHouseLOD(camera,house,previous='low') {
  const distance=houseCameraDistance(camera,house);
  if(previous==='high'&&distance<HOUSE_LOD_BANDS.highOut)return 'high';
  if(distance<HOUSE_LOD_BANDS.highIn)return 'high';
  if(previous==='medium'&&distance<HOUSE_LOD_BANDS.mediumOut)return 'medium';
  if(distance<HOUSE_LOD_BANDS.mediumIn)return 'medium';
  return 'low';
}
