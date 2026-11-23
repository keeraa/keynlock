// Closed circular wall, with the lower edge following the six barrel vaults.
export function createDrumGeometry(THREE,config,layout){
 const {radius,height,vaultRise,domeBaseHeight,wingWidth}=config.building;
 const inner=radius-.08,outer=radius+.24,segments=192,positions=[],uv=[],indices=[];
 function bottom(x,z){
  for(const h of layout.halls){const p=layout.local(h,x,z);if(p.z>=h.start-.5&&Math.abs(p.x)<=wingWidth/2+.2){
   const t=Math.min(1,Math.abs(p.x)/(wingWidth/2));return height-vaultRise+vaultRise*Math.sqrt(1-t*t)-.08;
  }}
  return height-.08;
 }
 for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2;
  for(const [r,top]of [[inner,false],[inner,true],[outer,false],[outer,true]]){
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=top?domeBaseHeight:bottom(x,z);
   positions.push(x,y,z);uv.push(a*radius/4,y/4);
  }
 }
 for(let i=0;i<segments;i++){
  const a=i*4,b=a+4;
  indices.push(a,a+1,b,a+1,b+1,b, a+2,b+2,a+3,a+3,b+2,b+3,
   a+1,a+3,b+1,a+3,b+3,b+1, a,b,a+2,a+2,b,b+2);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
