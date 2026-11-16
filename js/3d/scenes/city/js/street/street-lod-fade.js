// Fade only local copies of architectural detail materials, leaving shared
// facade and roof textures opaque. Optional alpha hashing supports opaque
// dither transitions; the street scene uses smooth alpha blending instead.
export const HOUSE_LOD_FADE_MS=600;
export const houseDetailRank=Object.freeze({low:0,medium:1,high:2});

export function fadeEase(t) {
  const clamped=Math.min(1,Math.max(0,t));
  return clamped*clamped*(3-2*clamped);
}

// The permanent facade/roof stays solid; only the smaller architectural details
// are crossfaded. Never blend full-size overlapping textured walls.
export function isolateHouseFade(group,start=0,order=12,{fixedMaterials=[],showFixed=true,dither=false}={}) {
  const fixed=new Set(fixedMaterials);
  const entries=[];
  const fixedEntries=[];
  group.traverse(object=>{
    if(!object.isMesh)return;
    const original=object.material;
    const originals=Array.isArray(original)?original:[original];
    if(object.userData.houseInvariant||originals.every(material=>fixed.has(material))){
      fixedEntries.push({object,visible:object.visible});
      object.visible=showFixed;
      return;
    }
    const temporaries=originals.map(material=>{
      const temporary=material.clone();
      temporary.transparent=!dither;
      temporary.depthWrite=dither;
      temporary.alphaHash=dither;
      return temporary;
    });
    object.material=Array.isArray(original)?temporaries:temporaries[0];
    const renderOrder=object.renderOrder;
    object.renderOrder=order;
    entries.push({object,original,temporaries,renderOrder,
      visible:object.visible,baseOpacity:originals.map(material=>material.opacity)});
  });
  let disposed=false;
  const setOpacity=value=>{
    if(disposed)return;
    const amount=Math.min(1,Math.max(0,value));
    for(const entry of entries){
      entry.object.visible=entry.visible&&amount>.002;
      entry.temporaries.forEach((temporary,i)=>{
        temporary.opacity=entry.baseOpacity[i]*amount;
      });
    }
  };
  setOpacity(start);
  return {
    setOpacity,
    release(){
      if(disposed)return;
      disposed=true;
      for(const entry of entries){
        entry.object.material=entry.original;
        entry.object.renderOrder=entry.renderOrder;
        entry.object.visible=entry.visible;
        entry.temporaries.forEach(material=>material.dispose());
      }
      for(const entry of fixedEntries)entry.object.visible=entry.visible;
    },
  };
}
