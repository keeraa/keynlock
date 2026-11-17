// Materials that never change with the house palette are shared by all houses
// created with the same Three.js module. Tinted facade materials stay private.
const buckets = new WeakMap();

export function acquireFixedHouseMaterials(THREE) {
  let bucket=buckets.get(THREE);
  if(!bucket) {
    const standard = config => new THREE.MeshStandardMaterial(config);
    bucket={refs:0,materials:{
      // Alpha-to-coverage lit the semi-transparent pixels along chipped edges
      // into a one-pixel white outline under the strong studio lighting.
      // A slightly tinted, clean alpha cut keeps only the actual stone paint.
      damage:standard({color:'#d6c9b7',opacity:0,roughness:1,
        transparent:false,alphaTest:.68,alphaToCoverage:false,
        depthWrite:true,side:THREE.FrontSide,
        polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
      woodDark:standard({color:'#312d2a',roughness:1}),
      stone:standard({color:'#8c8d82',roughness:1,flatShading:true}),
      stoneLight:standard({color:'#bbb5a5',roughness:1}),
      highlight:standard({color:'#e6d7b5',roughness:.94}),
      // Clear varnish and restrained reflections preserve the gouache map;
      // all house instances share one configurable physical material.
      glass:new THREE.MeshPhysicalMaterial({color:'#e5eeeb',metalness:.09,roughness:.2,
        clearcoat:.74,clearcoatRoughness:.13,
        emissive:'#133b42',emissiveIntensity:.045}),
      sill:standard({color:'#f6f0e7',roughness:.98}),
      stoneBand:standard({color:'#f1e9dd',roughness:.98}),
      brass:standard({color:'#c4a36b',roughness:.46,metalness:.38}),
      roofTop:standard({color:'#786f60',roughness:1}),
      chimney:standard({color:'#a8887a',roughness:1}),
    }};
    buckets.set(THREE,bucket);
  }
  bucket.refs++;
  let released=false;
  return {
    materials:bucket.materials,
    release() {
      if(released)return;
      released=true;
      if(--bucket.refs)return;
      Object.values(bucket.materials).forEach(material=>material.dispose());
      buckets.delete(THREE);
    },
  };
}

export function setHouseGlassAppearance(THREE,{gloss=74,reflection=46,night=false,glow=67,envMap=null}={}){
  const glass=buckets.get(THREE)?.materials.glass;
  if(!glass)return;
  const g=Math.max(0,Math.min(100,Number(gloss)||0))/100;
  const r=Math.max(0,Math.min(100,Number(reflection)||0))/100;
  glass.roughness=.87-g*.73;
  glass.metalness=r*.25;
  glass.clearcoat=g;
  glass.clearcoatRoughness=.48-g*.4;
  glass.envMap=envMap;
  glass.envMapIntensity=r*1.5;
  glass.emissive.set(night?'#ffcb85':'#133b42');
  glass.emissiveIntensity=night?Math.max(0,Math.min(100,Number(glow)||0))*.026:.045;
  glass.needsUpdate=true;
}

export function houseMaterialCacheStats(THREE) {
  const bucket=buckets.get(THREE);
  return {houses:bucket?.refs||0,materials:bucket?Object.keys(bucket.materials).length:0};
}
