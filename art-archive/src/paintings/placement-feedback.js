import {createWatercolorPlacement} from './watercolor-placement.js';
// A bounded, reusable puff pool: one draw call only while a painting settles.
export function createPlacementFeedback(THREE,scene,config,camera=null,renderer=null,onWatercolor=()=>{}){
 const watercolor=createWatercolorPlacement(THREE,scene,renderer,config);
 let effect='classic',request=0;
 const count=80,positions=new Float32Array(count*3),sizes=new Float32Array(count),seeds=new Float32Array(count);
 const homes=new Float32Array(count*3),velocities=new Float32Array(count*3);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:0},uScale:{value:700}},
  vertexShader:`attribute float aSize;attribute float aSeed;varying float vSeed;uniform float uScale;
   void main(){vSeed=aSeed;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=min(100.,aSize*uScale/max(.1,-p.z));}`,
  fragmentShader:`varying float vSeed;uniform float uOpacity;
   void main(){vec2 p=gl_PointCoord*2.-1.;float a=atan(p.y,p.x);float edge=1.+.09*sin(a*5.+vSeed*13.)+.055*sin(a*9.-vSeed*21.);float d=length(p)/edge;
    float alpha=(1.-smoothstep(.15,1.,d))*.3*uOpacity;if(alpha<.005)discard;
    gl_FragColor=vec4(mix(vec3(.80,.77,.69),vec3(.96,.93,.84),vSeed),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const smoke=new THREE.Points(geometry,material);smoke.name='placement-success';smoke.userData.atmosphere=true;smoke.userData.excludeFromInk=true;smoke.frustumCulled=false;smoke.visible=false;scene.add(smoke);
 let start=-Infinity;
 function showSmoke(slot,now){
  start=now;const width=slot.width,height=slot.height+config.paintings.frameWidthM*2;
  smoke.position.set(slot.x,config.building.floorElevation+slot.y,slot.z);smoke.rotation.y=Math.atan2(slot.normal.x,slot.normal.z);
  for(let i=0;i<count;i++){
   const side=i%4,t=(Math.floor(i/4)+.5)/(count/4),seed=(Math.sin(i*127.1+3.7)*43758.5453)%1,jitter=Math.abs(seed);
   const x=side<2?(t-.5)*width:(side===2?-width/2:width/2),y=side>=2?(t-.5)*height:(side===0?-height/2:height/2);
   const k=i*3;homes[k]=x;homes[k+1]=y;homes[k+2]=config.paintings.frameDepthM/2+.015;
   velocities[k]=(side===2?-1:side===3?1:0)*(.10+jitter*.14);velocities[k+1]=(side===0?-1:side===1?1:0)*(.10+jitter*.12)+.05;velocities[k+2]=.04+jitter*.09;
   seeds[i]=jitter;sizes[i]=.09+jitter*.12;
  }
  geometry.attributes.aSeed.needsUpdate=true;
  material.uniforms.uScale.value=(typeof innerHeight==='number'?innerHeight:800)*.5/Math.tan((camera?.fov??73)*Math.PI/360);
  update(now);
 }
 function update(now){
  const t=Math.max(0,(now-start)/1050);smoke.visible=t<1;if(!smoke.visible)return;
  const travel=t*(2-t);
  for(let i=0;i<count;i++){const k=i*3;positions[k]=homes[k]+velocities[k]*travel;positions[k+1]=homes[k+1]+velocities[k+1]*travel;positions[k+2]=homes[k+2]+velocities[k+2]*travel;sizes[i]=(.09+seeds[i]*.12)*(1+1.5*t);}
  geometry.attributes.position.needsUpdate=true;geometry.attributes.aSize.needsUpdate=true;
  material.uniforms.uOpacity.value=Math.min(1,t*12+.2)*Math.pow(1-t,1.5);
 }
 return {
  setEffect(value){if(effect===value)return;request++;start=-Infinity;smoke.visible=false;effect=value;watercolor.setEffect(value);},
  show(slot,now,hallColor){
   const ticket=++request;
   if(effect==='classic'){showSmoke(slot,now);return;}
   start=-Infinity;smoke.visible=false;
   watercolor.show(slot,now,hallColor).then(shown=>{
    if(ticket!==request)return;
    if(shown)onWatercolor();
    else showSmoke(slot,performance.now());
   });
  },
  update(now){update(now);watercolor.update(now);},
  dispose(){request++;watercolor.dispose();smoke.removeFromParent();geometry.dispose();material.dispose();},
 };
}
