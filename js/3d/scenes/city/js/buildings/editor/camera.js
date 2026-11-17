import { getHouseDimensions } from '../house-config.js';

export function createHouseCameraController({THREE,getConfig,getStage,getRenderer,getCamera,getControls,getFallback,onResize=()=>{}}) {
  let requestedView='three-quarter';
  let cameraAnimation=null;
function directionForView(view) {
  if(view==='front')return new THREE.Vector3(0,7,28);
  if(view==='side')return new THREE.Vector3(29,7,0);
  if(view==='top')return new THREE.Vector3(.01,34,6);
  return new THREE.Vector3(18,14,22);
}

function setView(view) {
  requestedView=view;
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  if(getFallback())getFallback().setView(view);
  const camera=getCamera();
  if(!camera)return;
  const dims=getHouseDimensions(getConfig());
  const target=new THREE.Vector3(0,dims.totalHeight*.46,0);
  cameraAnimation={target,position:directionForView(view).normalize().multiplyScalar(27).add(target)};
}

function fitView(reset) {
  const renderer=getRenderer(),camera=getCamera(),stage=getStage(),controls=getControls();
  if(!renderer || !camera || !stage)return;
  const width=stage.clientWidth,height=stage.clientHeight;
  if(!width||!height)return;
  const aspect=width/height;
  const dims=getHouseDimensions(getConfig());
  const vertical=Math.max(11.4,dims.totalHeight*1.50,(dims.width + dims.depth*.58)*.87);
  camera.top=vertical/2;camera.bottom=-vertical/2;
  camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
  onResize(width,height);
  if(reset){
    controls.target.set(0,dims.totalHeight*.46,0);
    camera.position.copy(directionForView(requestedView).normalize().multiplyScalar(27).add(controls.target));
    camera.zoom=1;camera.updateProjectionMatrix();controls.update();
  } else if(!cameraAnimation){
    const next=new THREE.Vector3(0,dims.totalHeight*.46,0);
    camera.position.add(next.clone().sub(controls.target));
    controls.target.copy(next);
  }
}


  function cancelAnimation() {cameraAnimation=null;}
  function animate(dt) {
    if(!cameraAnimation)return;
    const camera=getCamera(),controls=getControls();
    const speed=1-Math.exp(-dt*7.5);
    camera.position.lerp(cameraAnimation.position,speed);
    controls.target.lerp(cameraAnimation.target,speed);
    if(camera.position.distanceTo(cameraAnimation.position)<.016 && controls.target.distanceTo(cameraAnimation.target)<.016) {
      camera.position.copy(cameraAnimation.position);
      controls.target.copy(cameraAnimation.target);
      cameraAnimation=null;
    }
  }
  return {setView,fitView,animate,cancelAnimation};
}
