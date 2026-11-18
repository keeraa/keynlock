// Assembly camera looks down at the bench with the far edge receding by 20°.
export const ASSEMBLY_TILT_RADIANS=20*Math.PI/180;

export function assemblyOverheadDirection(THREE){
  return new THREE.Vector3(0,Math.cos(ASSEMBLY_TILT_RADIANS),
    Math.sin(ASSEMBLY_TILT_RADIANS));
}

export function assemblyOverheadPosition(THREE,target,distance=11.5){
  return target.clone().addScaledVector(assemblyOverheadDirection(THREE),distance);
}

// Drag the camera parallel to the workbench. Keeping the original point under
// the cursor prevents the reduced/diagonal movement caused by OrbitControls'
// screen-space pan when the assembly camera is tilted just 20 degrees.
export function createBenchPanController({THREE,canvas,camera,controls,planeY=-1.5}){
  const raycaster=new THREE.Raycaster();
  const ndc=new THREE.Vector2();
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-planeY);
  const anchor=new THREE.Vector3(),current=new THREE.Vector3(),shift=new THREE.Vector3();
  let activePointer=null;

  function project(clientX,clientY,out){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return false;
    ndc.set((clientX-rect.left)/rect.width*2-1,
      1-(clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(ndc,camera);
    return Boolean(raycaster.ray.intersectPlane(plane,out));
  }
  return {
    begin(pointerId,x,y){
      if(activePointer!==null||!project(x,y,anchor))return false;
      activePointer=pointerId;return true;
    },
    move(pointerId,x,y){
      if(activePointer!==pointerId||!project(x,y,current))return false;
      shift.subVectors(anchor,current);shift.y=0;
      camera.position.add(shift);
      controls.target.add(shift);
      controls.update();
      return true;
    },
    end(pointerId){
      if(activePointer!==pointerId)return false;
      activePointer=null;return true;
    },
    cancel(){activePointer=null;}
  };
}
