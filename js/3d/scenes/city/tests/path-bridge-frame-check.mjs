import assert from 'node:assert/strict';
import {bridgeLocal,bridgeWorld,bridgeRoadPortal,bridgeRoadWidth,
  bridgePavingCutout,bridgeWaterOpening,BRIDGE_ROAD_OVERLAP} from '../js/path-builder/bridge-frame.js';
import {KEYNLOCK_FIXED_BRIDGES,fixedBridgeWaterAt} from '../js/path-builder/keynlock-fixed-bridges.js';

const examples=[...KEYNLOCK_FIXED_BRIDGES,{id:'arch',x:41,z:-35,dirX:Math.SQRT1_2,
  dirZ:Math.SQRT1_2,span:22,deckWidth:8.6,width:12,landApproachLength:2}];
for(const bridge of examples){
  const width=bridgeRoadWidth(bridge),cut=bridgePavingCutout(bridge);
  assert.ok(width>0&&width<=bridge.deckWidth,
    'The shared road stays between the bridge parapets');
  assert.equal(cut.halfLength,bridge.span/2-BRIDGE_ROAD_OVERLAP);
  assert.ok(cut.halfWidth>=width/2);
  for(const side of [-1,1]){
    const portal=bridgeRoadPortal(bridge,side),local=bridgeLocal(bridge,...portal);
    assert.ok(Math.abs(local.along-side*cut.halfLength)<1e-5,
      'The approach joins the exact edge of the GPU/canvas paving cutout');
    assert.ok(Math.abs(local.across)<1e-5);
  }
  for(const along of [-bridge.span/3,0,bridge.span/3])for(const across of [-2,0,2]){
    const local=bridgeLocal(bridge,...bridgeWorld(bridge,along,across));
    assert.ok(Math.abs(local.along-along)<1e-6&&Math.abs(local.across-across)<1e-6);
  }
  const water=bridgeWaterOpening(bridge);
  assert.ok(water.halfLength>0&&water.halfWidth>0);
  if(bridge.fixed){
    assert.equal(fixedBridgeWaterAt(...bridgeWorld(bridge,0)),true);
    assert.equal(fixedBridgeWaterAt(...bridgeWorld(bridge,bridge.span/2)),false,
      'Water cutout stops before the dry bridgehead');
  }
}
console.log('Unified bridge frame: model, road, navigation and water cutouts aligned');
