import {acquireHouseAtmosphereResources,BUILDING_ATMOSPHERE_DEFAULTS,
  BUILDING_SMOKE_RISE,BUILDING_SMOKE_RATE,buildingSmokeFade} from './house-atmosphere.js';

// Shared smoke renderer for the city, landmarks and street quarters.
// Each plume is a single animated point inside one GPU draw, with no Sprites.
export function createBuildingSmokeBatch(T,particles,{resources=null,settings={},
  name='building-gouache-smoke',pointScale=350,nearDistance=Infinity}={}){
  const owned=!resources;
  const lease=resources??acquireHouseAtmosphereResources(T);
  const geometry=new T.BufferGeometry();
  const positions=new T.Float32BufferAttribute(new Float32Array(particles.length*3),3);
  const colors=new T.Float32BufferAttribute(new Float32Array(particles.length*4),4);
  const sizes=new T.Float32BufferAttribute(new Float32Array(particles.length),1);
  geometry.setAttribute('position',positions);
  geometry.setAttribute('color',colors);
  geometry.setAttribute('puffSize',sizes);
  const material=new T.ShaderMaterial({
    uniforms:{puffMap:{value:lease.smokeMaps[1]},density:{value:1},
      pointScale:{value:pointScale},smokeTint:{value:new T.Color('#dbe0d5')}},
    vertexShader:`attribute vec4 color;
      attribute float puffSize;
      uniform float pointScale;
      varying float vSmokeAlpha;
      void main(){
        vSmokeAlpha=color.a;
        vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*viewPosition;
        float modelScale=length(modelMatrix[0].xyz);
        gl_PointSize=clamp(puffSize*pointScale*modelScale/max(1.0,-viewPosition.z),1.5,80.0);
      }`,
    fragmentShader:`uniform sampler2D puffMap;
      uniform vec3 smokeTint;
      uniform float density;
      varying float vSmokeAlpha;
      void main(){
        vec4 pigment=texture2D(puffMap,gl_PointCoord);
        float opacity=pigment.a*vSmokeAlpha*density*.88;
        if(opacity<.02)discard;
        gl_FragColor=vec4(pigment.rgb*smokeTint,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,depthTest:true,
  });
  const points=new T.Points(geometry,material);
  points.name=name;
  points.frustumCulled=false;
  let options={...BUILDING_ATMOSPHERE_DEFAULTS,...settings};
  function setSettings(patch={}){
    options={...options,...patch};
    points.visible=Boolean(options.smoke)&&options.smokeDensity>0;
    material.uniforms.puffMap.value=lease.smokeMaps[options.smokeOutline?1:0];
    material.uniforms.density.value=Math.max(0,Math.min(100,options.smokeDensity))/100;
    material.uniforms.smokeTint.value.set(options.night?'#b3b8c3':'#dbe0d5');
  }
  function update(elapsed=0,cameraPosition=null){
    if(!points.visible)return;
    for(let i=0;i<particles.length;i++){
      const particle=particles[i],age=(elapsed*BUILDING_SMOKE_RATE+particle.phase)%1;
      const {x,y,z,seed}=particle;
      positions.setXYZ(i,x+Math.sin(age*6+seed)*age*.8,
        y-.16+age*BUILDING_SMOKE_RISE,z+Math.cos(age*4+seed)*age*.8);
      sizes.setX(i,.56+age*3.1);
      const isNear=!cameraPosition||Math.hypot(cameraPosition.x-x,cameraPosition.y-y,cameraPosition.z-z)<nearDistance;
      colors.setXYZW(i,1,1,1,isNear?buildingSmokeFade(age)*.83:0);
    }
    positions.needsUpdate=true;colors.needsUpdate=true;sizes.needsUpdate=true;
  }
  let disposed=false;
  function dispose(){
    if(disposed)return;
    disposed=true;geometry.dispose();material.dispose();
    if(owned)lease.release();
  }
  setSettings();update(0);
  return {points,particles,setSettings,update,dispose};
}
