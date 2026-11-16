// Materials that never change with the house palette are shared by all houses
// created with the same Three.js module. Tinted facade materials stay private.
const buckets = new WeakMap();

export function acquireFixedHouseMaterials(THREE) {
  let bucket=buckets.get(THREE);
  if(!bucket) {
    const standard = config => new THREE.MeshStandardMaterial(config);
    bucket={refs:0,materials:{
      damage:standard({color:'#ffffff',opacity:0,roughness:1,
        transparent:false,alphaTest:.1,alphaToCoverage:true,
        depthWrite:true,side:THREE.FrontSide,
        polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
      woodDark:standard({color:'#312d2a',roughness:1}),
      stone:standard({color:'#8c8d82',roughness:1,flatShading:true}),
      stoneLight:standard({color:'#bbb5a5',roughness:1}),
      highlight:standard({color:'#e6d7b5',roughness:.94}),
      glass:standard({color:'#47717e',metalness:.05,roughness:.23,emissive:'#173943',emissiveIntensity:.13}),
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

export function houseMaterialCacheStats(THREE) {
  const bucket=buckets.get(THREE);
  return {houses:bucket?.refs||0,materials:bucket?Object.keys(bucket.materials).length:0};
}
