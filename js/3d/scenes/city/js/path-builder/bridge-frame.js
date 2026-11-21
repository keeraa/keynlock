// One geometric contract for bridge construction, terrain, road routing,
// water openings and the painted paving mask. Coordinates are in metres.
export const BRIDGE_ROAD_OVERLAP=.06;
export const BRIDGE_PAVING_SIDE_CLEARANCE=.22;
export const BRIDGE_ROUTING_END_CLEARANCE=.6;
export const BRIDGE_ROUTING_SIDE_CLEARANCE=.35;
export const BRIDGE_ROAD_RAMP_LENGTH=3.2;

export function bridgeLocal(bridge,x,z){
  const dx=x-bridge.x,dz=z-bridge.z;
  return {along:dx*bridge.dirX+dz*bridge.dirZ,
    across:-dx*bridge.dirZ+dz*bridge.dirX};
}

export function bridgeWorld(bridge,along,across=0){
  return [bridge.x+along*bridge.dirX-across*bridge.dirZ,
    bridge.z+along*bridge.dirZ+across*bridge.dirX];
}

export function bridgeRoadPortal(bridge,side){
  return bridgeWorld(bridge,Math.sign(side||1)*(bridge.span/2-BRIDGE_ROAD_OVERLAP));
}

export function bridgeRoadWidth(bridge){
  return Math.max(1.3,Math.min(bridge.deckWidth-.58,6.4));
}

export function bridgePavingCutout(bridge){
  return {halfLength:Math.max(0,bridge.span/2-BRIDGE_ROAD_OVERLAP),
    halfWidth:bridge.deckWidth/2+BRIDGE_PAVING_SIDE_CLEARANCE};
}

export function bridgeWaterOpening(bridge){
  return {halfLength:Math.max(0,bridge.span/2-(bridge.landApproachLength||0)),
    halfWidth:(bridge.cutWidth||bridge.width||bridge.deckWidth)/2};
}
