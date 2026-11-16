import {BLADE_RIGHT,KEY_BOTTOM_Y,TIP_START_X,TIP_BOTTOM_Y,
  keyTopOutline,cutLayout} from './logic.js';
import {createKeyBowShape} from './key-bow.js';

// One continuous, closed outline and one circular opening; reused by the
// paper drawing and the actual depression in the soap.
export function keyImprintContours(THREE,targets){
  const upper=keyTopOutline(targets,cutLayout(targets.length));
  const bow=createKeyBowShape(THREE).getPoints(64).map(v=>[v.x,v.y]);
  const outer=[...upper,[BLADE_RIGHT,TIP_BOTTOM_Y],
    [TIP_START_X,KEY_BOTTOM_Y],
    ...bow.slice(1,-1).reverse(),upper[0]];
  const hole=Array.from({length:65},(_,i)=>{
    const angle=i/64*Math.PI*2;
    return [-2.12+Math.cos(angle)*.128,
      -.105+Math.sin(angle)*.128];
  });
  return [outer,hole];
}
