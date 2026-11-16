// Backward-compatible wear profiles for previously saved keys. Their 4/6/8
// notches remain the lock code, including damage between individual notches.
import {BLADE_LEFT,BLADE_RIGHT,KEY_TOP_Y,MAX_CUT,BREAK_CUT,cutTolerance,
  keyTopAtX,inspectKey} from './logic.js';
import {keyBladeBottomAt} from './key-blade.js';

export const WEAR_SEGMENTS=128;
export const WEAR_STEP=(BLADE_RIGHT-BLADE_LEFT)/WEAR_SEGMENTS;
export const wearSampleX=i=>BLADE_LEFT+i*WEAR_STEP;
export const emptyWearProfile=()=>Array(WEAR_SEGMENTS+1).fill(0);

export function normalizeWearProfile(value){
  if(!Array.isArray(value)||value.length!==WEAR_SEGMENTS+1)return emptyWearProfile();
  return value.map(v=>Number.isFinite(v)?Math.max(0,Math.min(MAX_CUT,v)):0);
}

export function wearDepthAtX(wear,x){
  if(!wear?.length||x<BLADE_LEFT||x>BLADE_RIGHT)return 0;
  const position=Math.max(0,Math.min(WEAR_SEGMENTS,(x-BLADE_LEFT)/WEAR_STEP));
  const before=Math.floor(position),after=Math.min(WEAR_SEGMENTS,before+1);
  return (wear[before]||0)*(1-(position-before))+(wear[after]||0)*(position-before);
}

export function machinedTopAtX(cuts,layout,wear,x){
  const base=keyTopAtX(cuts,layout,x);
  if(base===null)return null;
  return Math.max(keyBladeBottomAt(x)+.002,base-wearDepthAtX(wear,x));
}

// Preserve every original corner and interpolate any previously saved wear.
export function applyWearToOutline(outline,wear){
  if(!wear?.some(value=>value>1e-7))return outline;
  const machined=[];
  for(let i=1;i<outline.length;i++){
    const [x0,y0]=outline[i-1],[x1,y1]=outline[i];
    const steps=Math.max(1,Math.ceil((x1-x0)/(WEAR_STEP*.75)));
    for(let j=i===1?0:1;j<=steps;j++){
      const t=j/steps,x=x0+(x1-x0)*t;
      const y=y0+(y1-y0)*t-wearDepthAtX(wear,x);
      machined.push([x,Math.max(keyBladeBottomAt(x)+.002,y)]);
    }
  }
  return machined;
}

// Through-damage leaves a real gap between independently capped brass pieces.
export function splitMachinedOutlineAt(outline,atX){
  const x=Math.max(BLADE_LEFT+.025,Math.min(BLADE_RIGHT-.025,atX));
  const leftX=x-.009,rightX=x+.009;
  const left=outline.filter(([px])=>px<leftX);
  const right=outline.filter(([px])=>px>rightX);
  left.push([leftX,keyBladeBottomAt(leftX)+.002]);
  right.unshift([rightX,keyBladeBottomAt(rightX)+.002]);
  return [left,right];
}

export function effectiveCuts(cuts,layout,wear){
  return layout.map(({center})=>{
    const top=machinedTopAtX(cuts,layout,wear,center);
    return Math.max(0,Math.min(MAX_CUT,KEY_TOP_Y-(top??KEY_TOP_Y)));
  });
}

export function inspectMachinedKey(cuts,targets,layout,wear){
  const checked=inspectKey(effectiveCuts(cuts,layout,wear),targets);
  let extraOvercut=false,fractureX=null;
  if(wear?.some(v=>v>1e-7)){
    for(let i=0;i<=WEAR_SEGMENTS;i++){
      const x=wearSampleX(i),top=machinedTopAtX(cuts,layout,wear,x);
      if(top===null)continue;
      const targetTop=keyTopAtX(targets,layout,x);
      const nearest=layout.reduce((best,item,index)=>
        Math.abs(item.center-x)<Math.abs(layout[best].center-x)?index:best,0);
      if(top<targetTop-cutTolerance(targets[nearest]))extraOvercut=true;
      if(top-keyBladeBottomAt(x)<=.003&&fractureX===null)fractureX=x;
    }
  }
  return {...checked,extraOvercut,fractureX,
    accurate:checked.accurate&&!extraOvercut&&fractureX===null,
    overshot:checked.overshot||extraOvercut||fractureX!==null,
    brokenAt:checked.brokenAt>=0?checked.brokenAt:
      (fractureX!==null?layout.reduce((best,item,i)=>
        Math.abs(item.center-fractureX)<Math.abs(layout[best].center-fractureX)?i:best,0):-1)};
}
