export function createPlacementFeedback(THREE,scene,config){
  const material=new THREE.LineBasicMaterial({color:0xe8d392,transparent:true,opacity:0,depthWrite:false});
  const geometry=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.5,-.5,0),new THREE.Vector3(.5,-.5,0),
    new THREE.Vector3(.5,.5,0),new THREE.Vector3(-.5,.5,0)]);
  const outline=new THREE.LineLoop(geometry,material);outline.name='placement-success';outline.visible=false;scene.add(outline);
  let start=-Infinity,width=0,height=0;
  function show(slot,now){
    start=now;width=slot.width+.03;height=slot.height+config.paintings.frameWidthM*2+.03;
    const depth=config.paintings.frameDepthM*.55+.012;
    outline.position.set(slot.x+slot.normal.x*depth,config.building.floorElevation+slot.y,slot.z+slot.normal.z*depth);
    outline.rotation.set(0,Math.atan2(slot.normal.x,slot.normal.z),0);update(now);
  }
  function update(now){
    const t=Math.max(0,(now-start)/850);outline.visible=t<1;
    if(!outline.visible)return;
    const pulse=1+Math.sin(Math.PI*t)*.025;
    outline.scale.set(width*pulse,height*pulse,1);
    material.opacity=Math.sin(Math.PI*Math.min(1,t*3))*(1-t);
    if(t>.33)material.opacity=(1-t)*.85;
  }
  return {show,update,dispose(){outline.removeFromParent();geometry.dispose();material.dispose();}};
}
