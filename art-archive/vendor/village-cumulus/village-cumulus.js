import {createCumulusField,CUMULUS_QUALITY} from './village-cumulus-field.js';
// Original bounded sky volume, shared density/transport settings for GLSL and TSL.
// A sky layer: opaque scenery must be below it. It never creates its own renderer.
const vertexShader=`varying vec3 cloudLocal; void main(){cloudLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader=`precision highp sampler3D;
 out vec4 cumulusColor;
 #define gl_FragColor cumulusColor
 varying vec3 cloudLocal;
 uniform sampler3D field; uniform mat4 worldInverse; uniform vec3 eye, sunDirection, sunColor, shadeColor;
 uniform float coverage, extinction, clock, speed, sampleCount;
 float densityAt(vec3 p){
  vec3 uv=p+vec3(.5);float border=smoothstep(0.,.08,uv.x)*smoothstep(0.,.08,uv.z)*smoothstep(0.,.08,1.-uv.x)*smoothstep(0.,.08,1.-uv.z);
  uv.xz=fract(uv.xz+vec2(clock*speed*.006,clock*speed*.002));
  return smoothstep(1.-coverage,1.15-coverage,texture(field,uv).r)*border;
 }
 void main(){
  vec3 start=(worldInverse*vec4(eye,1.)).xyz;
  vec3 direction=normalize(cloudLocal-start);vec3 reciprocal=1./(direction+vec3(.000001));
  vec3 a=(-vec3(.5)-start)*reciprocal,b=(vec3(.5)-start)*reciprocal;
  vec3 lo=min(a,b),hi=max(a,b);float enter=max(0.,max(lo.x,max(lo.y,lo.z))),leave=min(hi.x,min(hi.y,hi.z));
  if(leave<=enter)discard;float stride=(leave-enter)/sampleCount,transmission=1.;vec3 light=vec3(0.);
  for(int i=0;i<44;i++){
   if(float(i)>=sampleCount||transmission<.015)break;
   vec3 p=start+direction*(enter+(float(i)+.5)*stride);float d=densityAt(p);
   float blocked=densityAt(clamp(p+sunDirection*.08,vec3(-.499),vec3(.499)));
   float illumination=exp(-blocked*2.8);float absorption=1.-exp(-d*extinction*stride);
   vec3 tint=mix(shadeColor,sunColor,illumination*.85+.15);
   light+=transmission*absorption*tint;transmission*=1.-absorption;
  }
  float alpha=1.-transmission;if(alpha<.002)discard;gl_FragColor=vec4(light/max(alpha,.0001),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
export function createVillageCumulus(THREE,{scene,camera,tsl=null,seed=37,quality='medium',height=28,coverage=.65,extinction=12,speed=.5}={}){
 if(!scene||!camera||!Number.isFinite(height)||!CUMULUS_QUALITY[quality])throw Error('Cumulus needs scene, camera and a known quality');
 const {data,size}=createCumulusField({seed}),map=new THREE.Data3DTexture(data,size,size,size);
 map.format=THREE.RedFormat;map.minFilter=map.magFilter=THREE.LinearFilter;map.unpackAlignment=1;map.needsUpdate=true;
 const values={field:{value:map},worldInverse:{value:new THREE.Matrix4()},eye:{value:camera.position},sunDirection:{value:new THREE.Vector3(.4,.8,.2).normalize()},sunColor:{value:new THREE.Color('#fff4df')},shadeColor:{value:new THREE.Color('#788d9e')},coverage:{value:.65},extinction:{value:12},clock:{value:0},speed:{value:.5},sampleCount:{value:CUMULUS_QUALITY[quality]}};
 let material,nodes;
 if(tsl){
  nodes=Object.fromEntries(Object.entries(values).filter(([k])=>!['field','worldInverse','eye'].includes(k)).map(([k,v])=>[k,tsl.uniform(v.value)]));
  const texture=tsl.texture3D(map);
  const densityAt=p=>{
   const uv=p.add(.5),edge=tsl.smoothstep(0,.08,uv.x).mul(tsl.smoothstep(0,.08,uv.z)).mul(tsl.smoothstep(0,.08,tsl.float(1).sub(uv.x))).mul(tsl.smoothstep(0,.08,tsl.float(1).sub(uv.z)));
   const drift=tsl.vec2(nodes.clock.mul(nodes.speed).mul(.006),nodes.clock.mul(nodes.speed).mul(.002));
   const coord=tsl.vec3(uv.xz.add(drift).fract().x,uv.y,uv.xz.add(drift).fract().y);
   return tsl.smoothstep(tsl.float(1).sub(nodes.coverage),tsl.float(1.15).sub(nodes.coverage),texture.sample(coord).r).mul(edge);
  };
  material=new THREE.MeshBasicNodeMaterial();
  material.fragmentNode=tsl.Fn(()=>{
   const start=tsl.modelWorldMatrixInverse.mul(tsl.vec4(tsl.cameraPosition,1)).xyz,dir=tsl.positionLocal.sub(start).normalize(),inv=tsl.float(1).div(dir.add(.000001));
   const a=tsl.vec3(-.5).sub(start).mul(inv),b=tsl.vec3(.5).sub(start).mul(inv),lo=tsl.min(a,b),hi=tsl.max(a,b);
   const enter=tsl.max(0,tsl.max(lo.x,tsl.max(lo.y,lo.z))),leave=tsl.min(hi.x,tsl.min(hi.y,hi.z));
   tsl.If(leave.lessThanEqual(enter),()=>tsl.Discard());
   const stride=leave.sub(enter).div(nodes.sampleCount),transmission=tsl.float(1).toVar(),light=tsl.vec3(0).toVar();
   tsl.Loop({start:0,end:nodes.sampleCount,type:'int',condition:'<'},({i})=>{
    tsl.If(transmission.lessThan(.015),()=>tsl.Break());
    const p=start.add(dir.mul(enter.add(tsl.float(i).add(.5).mul(stride)))),d=densityAt(p);
    const blocked=densityAt(p.add(nodes.sunDirection.mul(.08)).clamp(-.499,.499)),illumination=blocked.mul(-2.8).exp();
    const absorption=tsl.float(1).sub(d.mul(nodes.extinction).mul(stride).negate().exp()),tint=tsl.mix(nodes.shadeColor,nodes.sunColor,illumination.mul(.85).add(.15));
    light.addAssign(transmission.mul(absorption).mul(tint));transmission.mulAssign(tsl.float(1).sub(absorption));
   });
   const alpha=tsl.float(1).sub(transmission);tsl.If(alpha.lessThan(.002),()=>tsl.Discard());return tsl.vec4(light.div(alpha.max(.0001)),alpha);
  })();
 }else material=new THREE.ShaderMaterial({vertexShader,fragmentShader,glslVersion:THREE.GLSL3,uniforms:values});
 material.side=THREE.BackSide;material.transparent=true;material.depthWrite=false;material.depthTest=true;
 const geometry=new THREE.BoxGeometry(1,1,1),group=new THREE.Group();group.name='Village cumulus · original density and light';
 const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(72,18,44);mesh.position.set(0,height,-22);mesh.userData.villageCategory='clouds';group.add(mesh);scene.add(group);
 if(!tsl)mesh.onBeforeRender=()=>{values.worldInverse.value.copy(mesh.matrixWorld).invert();material.uniformsNeedUpdate=true;};
 let disposed=false;
 function configure(settings={}){
  for(const [key,a,b]of [['coverage',0,1],['extinction',0,30],['speed',0,4]])if(Number.isFinite(settings[key]))values[key].value=Math.max(a,Math.min(b,settings[key]));
  if(CUMULUS_QUALITY[settings.quality])values.sampleCount.value=CUMULUS_QUALITY[settings.quality];
  if(settings.sunDirection?.isVector3&&settings.sunDirection.lengthSq()>0)values.sunDirection.value.copy(settings.sunDirection).normalize();
  for(const key of ['sunColor','shadeColor'])if(settings[key])values[key].value.set(settings[key]);
  if(nodes)for(const [k,n]of Object.entries(nodes))n.value=values[k].value;
 }
 configure({coverage,extinction,speed});
 return {group,configure,update(dt=0){if(disposed)return;if(Number.isFinite(dt))values.clock.value+=Math.max(0,dt);if(nodes)nodes.clock.value=values.clock.value;
  // Keep the bottom of a sky volume above the camera; never wash out the village.
  mesh.position.y=Math.max(height,camera.position.y+mesh.scale.y/2+3);},
  snapshot:()=>({qualitySteps:values.sampleCount.value,fieldBytes:data.byteLength,time:values.clock.value,coverage:values.coverage.value,rendererCount:0}),
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();geometry.dispose();material.dispose();map.dispose();}};
}
