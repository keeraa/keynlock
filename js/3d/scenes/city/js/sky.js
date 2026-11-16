/** Camera-centered painted sky. Its gentle gradient replaces the flat backdrop. */
export function createSky(THREE,scene,camera) {
  const material=new THREE.ShaderMaterial({
    uniforms:{
      uHorizon:{value:new THREE.Color('#ded0ae')},
      uZenith:{value:new THREE.Color('#8da5a8')},
    },
    vertexShader:`varying vec3 vLocal;void main(){vLocal=position;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uHorizon;uniform vec3 uZenith;
      varying vec3 vLocal;
      void main(){float h=smoothstep(-.16,.72,normalize(vLocal).y);
        gl_FragColor=vec4(mix(uHorizon,uZenith,h),1.0);}`,
    side:THREE.BackSide,depthWrite:false,depthTest:false,
  });
  const dome=new THREE.Mesh(new THREE.SphereGeometry(510,30,16),material);
  dome.renderOrder=-1000;dome.frustumCulled=false;dome.userData.atmosphere=true;scene.add(dome);
  return {
    update(){dome.position.copy(camera.position);},
    setTime(time){
      const palette={
        day:['#ded0ae','#8da5a8'],
        dusk:['#e0b596','#7c879a'],
        night:['#3c536c','#17283d'],
      }[time]||['#ded0ae','#8da5a8'];
      material.uniforms.uHorizon.value.set(palette[0]);
      material.uniforms.uZenith.value.set(palette[1]);
    },
    dispose(){scene.remove(dome);dome.geometry.dispose();material.dispose();},
  };
}
