import {PLAYER_DEFAULTS} from '../../config/runtime.js';
export function createPlayerCamera(THREE,config){
 const camera=new THREE.PerspectiveCamera(config.camera?.fov??73,1,.07,250);
 camera.position.set(PLAYER_DEFAULTS.spawn.x,config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight,PLAYER_DEFAULTS.spawn.z);return camera;
}
