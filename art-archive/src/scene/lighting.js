// Lighting owns no renderer or animation loop.
export function addArchiveLighting(THREE,scene,config){
 const hemi=new THREE.HemisphereLight(0xffeed5,0x7f9187,2.5);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffe8bf,3.1);sun.position.set(-28,65,24);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:160});sun.shadow.normalBias=.04;sun.shadow.bias=-.0004;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xb5d1d0,.8);fill.position.set(25,18,-30);scene.add(fill);
 const skylight=new THREE.HemisphereLight(0xf5f6f2,0x9b9180,config.building.diffuseCeiling?.fillIntensity??.55);scene.add(skylight);
 const lower=new THREE.PointLight(0xffd5a0,22,12,1.5);lower.position.set(0,config.building.floorElevation-2,0);scene.add(lower);
 return {dispose(){for(const light of [hemi,sun,fill,skylight,lower]){light.shadow?.map?.dispose();light.removeFromParent();}}};
}
