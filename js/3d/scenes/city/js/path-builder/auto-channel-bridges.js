import {keynlockWaterAt} from './keynlock-geography.js';
import {bridgeProfiles,LANDSCAPE_BOUNDS,LANDSCAPE_LIMITS,normalizeLandscape} from './landscape-model.js';
import {bridgeLocal} from './bridge-frame.js';

// The historic reference coastline has no editable river strokes. Find actual
// water intervals between neighboring buildings and create the missing land-
// to-land crossings, including isolated landmarks such as the clock tower.
const MAX_PAIR_DISTANCE=235,MIN_WATER_SPAN=7,MAX_WATER_SPAN=160;
const SHORE_OVERLAP=7;
const MAX_NEIGHBORS=9;
const RAY_STEP=1.25;
const ROTATIONS=[0,-15,15,-30,30,-45,45,-60,60,-75,75];
function waterCrossingsBetween(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  if(length<MIN_WATER_SPAN+10||length>MAX_PAIR_DISTANCE)return [];
  const ux=dx/length,uz=dz/length;
  const steps=Math.ceil(length/1.35),step=length/steps;
  const candidates=[];let opened=-1;
  for(let i=0;i<=steps;i++){
    const distance=i*step;
    const water=keynlockWaterAt(a.x+ux*distance,a.z+uz*distance);
    if(water&&opened<0)opened=i;
    if(!water&&opened>=0){
      const from=opened*step,to=(i-1)*step,waterLength=to-from+step;
      opened=-1;
      if(waterLength<MIN_WATER_SPAN||waterLength>MAX_WATER_SPAN||
        from<SHORE_OVERLAP+1||to>length-SHORE_OVERLAP-1)continue;
      const middle=(from+to)/2;
      candidates.push({x:a.x+ux*middle,z:a.z+uz*middle,dirX:ux,dirZ:uz,
        span:waterLength+SHORE_OVERLAP*2,width:waterLength,bankA:.18,bankB:.18,
        deckWidth:waterLength>14?8.6:4.25,rise:waterLength>14?2.8:1.85,
        depth:3,major:waterLength>14,channel:true,auto:true});
    }
  }
  return candidates;
}

function nearExisting(candidate,profiles,exclusions){
  if(exclusions.some(point=>Math.hypot(candidate.x-point.x,candidate.z-point.z)<65))return true;
  return profiles.some(bridge=>{
    const {along,across}=bridgeLocal(bridge,candidate.x,candidate.z);
    return Math.abs(along)<bridge.span/2+24&&
      Math.abs(across)<Math.max(bridge.deckWidth/2+35,45);
  });
}

function dryBankInterval(x,z,dirX,dirZ,deckWidth){
  if(!keynlockWaterAt(x,z))return null;
  const toLand=sign=>{
    for(let distance=RAY_STEP;distance<=MAX_WATER_SPAN+SHORE_OVERLAP;distance+=RAY_STEP)
      if(!keynlockWaterAt(x+sign*dirX*distance,z+sign*dirZ*distance))return distance;
    return null;
  };
  const backward=toLand(-1),forward=toLand(1);
  if(backward===null||forward===null)return null;
  const width=backward+forward-RAY_STEP;
  if(width<MIN_WATER_SPAN||width>MAX_WATER_SPAN)return null;
  // Centre the bridge between the two measured shoreline intersections.
  const middle=(forward-backward)/2;
  const cx=x+dirX*middle,cz=z+dirZ*middle;
  const crossX=-dirZ,crossZ=dirX;
  // Both bridge feet must stand on an actual patch of dry ground across the
  // entire masonry width. A clear centre point alone leaves a skewed corner
  // dangling over the river at bends and island tips.
  for(let overlap=SHORE_OVERLAP;overlap<=SHORE_OVERLAP+15;overlap+=2.5){
    const span=width+overlap*2,half=span/2;
    const feetDry=[-1,1].every(sign=>[-.5,0,.5].every(across=>
      !keynlockWaterAt(cx+sign*dirX*half+crossX*deckWidth*across,
        cz+sign*dirZ*half+crossZ*deckWidth*across)));
    if(feetDry)return {x:cx,z:cz,dirX,dirZ,width,span};
  }
  return null;
}

function buildingIntersectsSpan(candidate,buildings){
  return buildings.some(building=>{
    const {along,across}=bridgeLocal(candidate,building.x,building.z);
    const beyond=Math.max(0,Math.abs(along)-candidate.span/2);
    return Math.hypot(beyond,across)<Math.hypot(building.width||0,building.depth||0)/2+2;
  });
}

function alignAcrossRiver(raw,from,to,buildings){
  // A straight line from one building to another is usually NOT perpendicular
  // to a winding river. Survey both shores around the water intersection and
  // choose a short, dry-to-dry crossing that clears the actual house models.
  let best=null,bestScore=Infinity;
  for(const degrees of ROTATIONS){
    const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const dirX=raw.dirX*c-raw.dirZ*s,dirZ=raw.dirX*s+raw.dirZ*c;
    const tangentX=-dirZ,tangentZ=dirX;
    for(const shift of [0,-8,8,-16,16]){
      const centreX=raw.x+tangentX*shift,centreZ=raw.z+tangentZ*shift;
      const crossing=dryBankInterval(centreX,centreZ,dirX,dirZ,
        raw.width>14?8.6:4.25);
      if(!crossing)continue;
      const sideA=bridgeLocal(crossing,from.x,from.z).along;
      const sideB=bridgeLocal(crossing,to.x,to.z).along;
      if(sideA*sideB>=0||buildingIntersectsSpan(crossing,buildings))continue;
      const score=crossing.width+Math.abs(degrees)*.07+Math.abs(shift)*.19+
        (crossing.span-crossing.width-SHORE_OVERLAP*2)*.45;
      if(score>=bestScore)continue;
      bestScore=score;best=crossing;
    }
  }
  if(!best)return null;
  const major=Math.max(raw.width,best.width)>14;
  return {...raw,...best,bankA:.18,bankB:.18,
    deckWidth:major?8.6:4.25,rise:major?2.8:1.85,major};
}

export function addAutomaticChannelBridges(input,buildings=[]){
  const landscape=normalizeLandscape(input);
  // Re-survey existing automatic crossings as well. Previously stored bridges
  // were aligned to building-to-building diagonals, so preserving them would
  // keep the visible defects after the bridge algorithm is corrected.
  const manualBridges=landscape.channelBridges.filter(bridge=>!bridge.auto);
  if(buildings.length<2)return manualBridges.length===landscape.channelBridges.length?
    input:normalizeLandscape({...landscape,channelBridges:manualBridges});
  if(manualBridges.length>=LANDSCAPE_LIMITS.channelBridges)return input;
  const pairKeys=new Set(),pairs=[];
  for(let i=0;i<buildings.length;i++){
    const near=[];
    for(let j=0;j<buildings.length;j++)if(i!==j){
      const distance=Math.hypot(buildings[i].x-buildings[j].x,buildings[i].z-buildings[j].z);
      if(distance<=MAX_PAIR_DISTANCE)near.push({j,distance});
    }
    near.sort((a,b)=>a.distance-b.distance);
    for(const {j,distance} of near.slice(0,MAX_NEIGHBORS)){
      const key=`${Math.min(i,j)}-${Math.max(i,j)}`;
      if(pairKeys.has(key))continue;
      pairKeys.add(key);pairs.push({i,j,distance});
    }
  }
  pairs.sort((a,b)=>a.distance-b.distance);
  const profiles=bridgeProfiles({...landscape,channelBridges:manualBridges}),additions=[];
  for(const {i,j} of pairs){
    if(manualBridges.length+additions.length>=LANDSCAPE_LIMITS.channelBridges)break;
    for(const candidate of waterCrossingsBetween(buildings[i],buildings[j])){
      if(nearExisting(candidate,[...profiles,...additions],landscape.autoChannelOptOut))continue;
      const crossing=alignAcrossRiver(candidate,buildings[i],buildings[j],buildings);
      if(!crossing||
        Math.abs(crossing.x)+crossing.span/2>LANDSCAPE_BOUNDS.width/2-5||
        Math.abs(crossing.z)+crossing.span/2>LANDSCAPE_BOUNDS.depth/2-5||
        nearExisting(crossing,[...profiles,...additions],landscape.autoChannelOptOut))continue;
      additions.push({...crossing,id:`auto-channel-${Math.min(i,j)}-${Math.max(i,j)}`});
    }
  }
  const next=normalizeLandscape({...landscape,channelBridges:[...manualBridges,...additions]});
  return JSON.stringify(next.channelBridges)===JSON.stringify(landscape.channelBridges)?input:next;
}
