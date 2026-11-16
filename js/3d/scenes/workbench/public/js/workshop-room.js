export const WORKBENCH_TOP_Y=-1.82+.34/2;

// The same painted metal and wood palette is shared by the key and lock
// stations. Scene logic does not need to know where its textures come from.
export function createWorkshopMaterials(THREE){
  const loader=new THREE.TextureLoader();
  const texture=(name,repeat=1)=>{
    const map=loader.load(`./assets/${name}.webp`);
    map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.RepeatWrapping;
    map.repeat.set(repeat,repeat);map.anisotropy=4;return map;
  };
  const gearMap=texture('painted-gear');
  const pinMap=texture('painted-pin');
  const brassMap=texture('painted-brass');
  const steelMap=texture('painted-steel');
  return {
    brass:new THREE.MeshStandardMaterial({color:0xdfc293,map:gearMap,roughness:.53,metalness:.56}),
    steel:new THREE.MeshStandardMaterial({color:0x9eaeb3,map:gearMap,roughness:.48,metalness:.64}),
    dark:new THREE.MeshStandardMaterial({color:0x26363a,roughness:.71,metalness:.70}),
    dark2:new THREE.MeshStandardMaterial({color:0x47575a,map:steelMap,roughness:.65,metalness:.58}),
    copper:new THREE.MeshStandardMaterial({color:0xc99264,map:brassMap,roughness:.55,metalness:.58}),
    pin:new THREE.MeshStandardMaterial({color:0xf1d2a5,map:pinMap,roughness:.51,metalness:.57}),
    key:new THREE.MeshStandardMaterial({color:0xc9b89a,map:brassMap,roughness:.58,
      metalness:.52,side:THREE.DoubleSide}),
    spring:new THREE.MeshStandardMaterial({color:0xcbd5d5,roughness:.39,metalness:.79}),
    wood:new THREE.MeshStandardMaterial({color:0x694c34,roughness:.94}),
    woodTop:new THREE.MeshStandardMaterial({color:0x806048,roughness:.87}),
    glass:new THREE.MeshStandardMaterial({color:0x96aaa9,transparent:true,opacity:.18,
      depthWrite:false,metalness:.21,roughness:.28}),
    marker:new THREE.MeshBasicMaterial({color:0xf1c67c,transparent:true,opacity:0,
      depthWrite:false,depthTest:true,side:THREE.DoubleSide}),
    hit:new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,
      depthWrite:false,side:THREE.DoubleSide})
  };
}

export function populateWorkshopRoom(THREE,scene,shapes,mat){
  scene.add(new THREE.HemisphereLight(0xdbe6e1,0x3a3028,1.05));
  const sunlight=new THREE.DirectionalLight(0xffe5b6,3.0);
  sunlight.position.set(-3.4,7,5);sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(1024,1024);
  sunlight.shadow.camera.left=-8;sunlight.shadow.camera.right=8;
  sunlight.shadow.camera.top=8;sunlight.shadow.camera.bottom=-8;
  sunlight.shadow.bias=-.0006;scene.add(sunlight);
  const fill=new THREE.PointLight(0x83b8bd,55,11);
  fill.position.set(3.5,1.1,3.5);scene.add(fill);
  const halo=new THREE.PointLight(0xffc88b,32,8);
  halo.position.set(-3.8,2.1,-1.2);scene.add(halo);

  // One persistent workshop with two interchangeable work surfaces.
  shapes.box(scene,11.5,.34,6.6,0,-1.82,-.5,mat.woodTop,.08);
  shapes.box(scene,11.9,.13,6.9,0,-2.0,-.5,mat.wood,.02);
  for(const x of [-4.7,4.7])for(const z of [-2.7,1.8])
    shapes.box(scene,.28,2.4,.31,x,-3.12,z,mat.wood,.03);
  shapes.box(scene,13,8,.24,0,.55,-3.72,mat.dark2,.02);
  const wallLine=shapes.box(scene,12.7,.055,.08,0,1.86,-3.54,mat.copper,.02);
  wallLine.castShadow=false;
  const lamp=new THREE.Group();lamp.position.set(-3.95,2.34,-1.65);scene.add(lamp);
  shapes.cyl(lamp,.47,.13,0,0,0,mat.dark,'y',32);
  shapes.cyl(lamp,.13,.2,0,.17,0,mat.copper,'y',28);
  shapes.cyl(lamp,.035,.9,0,.7,0,mat.dark2,'y',20);
}
