import { Water } from './vendor-water.js';

/** Refresh expensive planar reflections on every camera change, or at 30 fps at rest. */
export function createReflectionGate(THREE,intervalMs=32) {
  const lastPosition=new THREE.Vector3();
  const lastQuaternion=new THREE.Quaternion();
  const lastProjection=new THREE.Matrix4();
  let hasReflection=false,lastTime=-Infinity,dirty=true;
  return {
    shouldRender(camera,now){
      const projection=camera.projectionMatrix.elements,previous=lastProjection.elements;
      let projectionChanged=false;
      for(let i=0;i<16;i++)if(Math.abs(projection[i]-previous[i])>1e-10){projectionChanged=true;break;}
      const moved=!hasReflection || camera.position.distanceToSquared(lastPosition)>1e-10 ||
        Math.abs(camera.quaternion.dot(lastQuaternion))<1-1e-10 || projectionChanged;
      if(!dirty&&!moved&&now-lastTime<intervalMs)return false;
      lastPosition.copy(camera.position);
      lastQuaternion.copy(camera.quaternion);
      lastProjection.copy(camera.projectionMatrix);
      lastTime=now;hasReflection=true;dirty=false;
      return true;
    },
    invalidate(){dirty=true;},
  };
}

/** Tileable, smooth directional swells for the official Three.js r187 water addon. */
function createNormalMap(THREE) {
  const resolution=256,bytes=new Uint8Array(resolution*resolution*4);
  const tau=Math.PI*2;
  const surface=(u,v)=>
    .52*Math.sin(tau*(3*u+2*v)+.46*Math.sin(tau*(u-2*v)))+
    .3*Math.sin(tau*(7*u-4*v))+
    .14*Math.cos(tau*(11*u+5*v)+.3*Math.sin(tau*(2*u+3*v)))+
    .09*Math.sin(tau*(17*u-9*v));
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++) {
    const u=x/resolution,v=y/resolution,step=1/resolution;
    const sx=(surface(u-step,v)-surface(u+step,v))*1.55;
    const sy=(surface(u,v-step)-surface(u,v+step))*1.55;
    const inverse=1/Math.hypot(sx,sy,1);
    const index=(y*resolution+x)*4;
    bytes[index]=Math.round((sx*inverse*.5+.5)*255);
    bytes[index+1]=Math.round((sy*inverse*.5+.5)*255);
    bytes[index+2]=Math.round((inverse*.5+.5)*255);
    bytes[index+3]=255;
  }
  const texture=new THREE.DataTexture(bytes,resolution,resolution,THREE.RGBAFormat);
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  texture.anisotropy=4;
  return texture;
}

/** Upgrade r187's true planar reflections with broad swells and a moving tidal edge. */
function enhanceOcean(sea) {
  const shader=sea.material;
  const vertexStart='mirrorCoord = modelMatrix * vec4( position, 1.0 );';
  const vertexProjection='vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );';
  const colorOutput='vec3 outgoingLight = albedo;';
  if(!shader.vertexShader.includes(vertexStart)||!shader.vertexShader.includes(vertexProjection)||
    !shader.fragmentShader.includes(colorOutput))throw new Error('Unexpected Three.js r187 Water shader');
  shader.vertexShader=shader.vertexShader.replace(vertexStart,`
    vec3 wavePosition=position;
    float seaDistance=312.0-position.y-(20.8+2.85*sin(position.x*.075)+1.35*sin(position.x*.19+1.3)
      +.38*sin(position.x*.46-.7)+1.5*exp(-pow((position.x+19.0)/7.0,2.0)));
    float deep=smoothstep(0.0,13.0,seaDistance);
    float tide=.26*sin(time*.15)+.09*sin(time*.51);
    wavePosition.z+=tide+(.16*sin(position.x*.115+position.y*.072+time*.64)
      +.085*sin(position.x*-.21+position.y*.083+time*.43))*(.21+.79*deep);
    mirrorCoord = modelMatrix * vec4( wavePosition, 1.0 );
  `);
  shader.vertexShader=shader.vertexShader.replace(vertexProjection,
    'vec4 mvPosition = modelViewMatrix * vec4( wavePosition, 1.0 );');
  shader.fragmentShader=shader.fragmentShader.replace('uniform sampler2D mirrorSampler;',
    'uniform sampler2D mirrorSampler; uniform float uNight;');
  shader.fragmentShader=shader.fragmentShader.replace(colorOutput,`
    // Shallow sand and turquoise shoals follow the same procedural coastline as the terrain.
    float shoreZ=20.8+2.85*sin(worldPosition.x*.075)+1.35*sin(worldPosition.x*.19+1.3)
      +.38*sin(worldPosition.x*.46-.7)+1.5*exp(-pow((worldPosition.x+19.0)/7.0,2.0));
    float shore=max(0.0,worldPosition.z-shoreZ);
    float shoal=1.0-smoothstep(1.0,39.0,shore);
    float wetSand=1.0-smoothstep(.0,6.7,shore);
    float waterMotion=sin(worldPosition.x*.43+time*.26+sin(worldPosition.z*.36-time*.23));
    float secondaryMotion=sin(worldPosition.z*.53-time*.28+sin(worldPosition.x*.31+time*.19));
    float caustic=smoothstep(.35,.96,waterMotion*secondaryMotion);
    vec3 turquoise=mix(vec3(.09,.58,.52),vec3(.17,.40,.47),smoothstep(3.0,35.0,shore));
    turquoise=mix(turquoise,vec3(.43,.45,.33),wetSand*.58);
    turquoise=mix(turquoise,vec3(.05,.21,.28),uNight*.78);
    vec3 deepTeal=mix(vec3(.11,.39,.45),vec3(.06,.19,.28),uNight*.9);
    vec3 outgoingLight=mix(mix(albedo,deepTeal,.33),turquoise,shoal*.86);
    outgoingLight+=vec3(.045,.062,.039)*caustic*shoal;

    // Two connected breaking wavefronts advance and withdraw along the entire beach.
    float tide=.26*sin(time*.15)+.09*sin(time*.51);
    float surf1=1.3-tide*2.5+sin(time*.78+worldPosition.x*.078)*.95+sin(worldPosition.x*.23-time*.39)*.25;
    float surf2=4.25-tide*2.0+sin(time*.58+worldPosition.x*.061+1.1)*1.2;
    float white1=exp(-pow((shore-surf1)/.53,2.0));
    float white2=exp(-pow((shore-surf2)/.76,2.0));
    float drift=.82+.18*sin(worldPosition.x*.75+sin(worldPosition.x*.28+time*.2));
    float foam=clamp((white1*.86+white2*.35)*drift,0.0,.90);
    outgoingLight=mix(outgoingLight,mix(vec3(.91,.94,.85),vec3(.36,.52,.56),uNight*.7),foam);
  `);
  // The real sand mesh remains visible through the shoals; deep water stays reflective.
  shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, alpha );',
    'gl_FragColor = vec4( outgoingLight, alpha*min(.97,mix(.51,.89,smoothstep(2.0,81.0,shore))+foam*.6) );');
  shader.needsUpdate=true;
}

/** Reflective ocean + matching animated normals on the sloping riverbed. */
export function createWaterMaterials(THREE) {
  const normalTexture=createNormalMap(THREE);
  const uTime={value:0},uNight={value:0};
  const uEye={value:new THREE.Vector3(26,80,105)};
  const reflectionGate=createReflectionGate(THREE);
  let lastTimeOfDay=null;
  const river=new THREE.ShaderMaterial({
    name:'Keynlock River — matched ocean normals',
    side:THREE.DoubleSide,
    transparent:true,
    depthWrite:false,
    uniforms:{uTime,uNight,uEye,normalSampler:{value:normalTexture}},
    vertexShader:`
      varying vec2 vUv;
      varying vec3 vWorld;
      void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uEye;
      uniform sampler2D normalSampler;
      varying vec2 vUv;
      varying vec3 vWorld;
      vec3 seaNormal(vec2 p){
        vec2 uv0=p/103.0+vec2(uTime/17.0,uTime/29.0);
        vec2 uv1=p/107.0-vec2(uTime/-19.0,uTime/31.0);
        vec2 uv2=p/vec2(8907.0,9803.0)+vec2(uTime/101.0,uTime/97.0);
        vec2 uv3=p/vec2(1091.0,1027.0)-vec2(uTime/109.0,uTime/-113.0);
        vec4 noise=texture2D(normalSampler,uv0)+texture2D(normalSampler,uv1)
          +texture2D(normalSampler,uv2)+texture2D(normalSampler,uv3);
        vec3 n=noise.xyz*.5-vec3(1.0);
        return normalize(vec3(n.x,n.z,n.y)*vec3(1.5,1.0,1.5));
      }
      void main(){
        vec3 normal=seaNormal(vWorld.xz*.78+vec2(vUv.y*.25,-uTime*.38));
        vec3 eye=normalize(uEye-vWorld);
        float fresnel=.02+.98*pow(1.0-max(dot(normal,eye),0.0),5.0);
        float flow=sin(vUv.y*2.7-uTime*.67+sin(vUv.x*4.5)*.7);
        float caustic=sin(vWorld.x*.36+uTime*.18)*sin(vWorld.z*.46-uTime*.25);
        float bankDistance=min(vUv.x,1.0-vUv.x);
        float deep=smoothstep(0.02,.38,bankDistance);
        vec3 shallow=vec3(.20,.53,.54)+vec3(.019,.029,.025)*(flow+caustic);
        vec3 reflection=vec3(.19,.40,.48)+vec3(.045,.055,.05)*max(0.,dot(normal,normalize(vec3(-.35,.86,.37))));
        vec3 day=mix(shallow,reflection,clamp(fresnel*.7+.13,.08,.66));
        day=mix(vec3(.34,.61,.57),day,.48+.52*deep);
        // Long, broken highlights help the channel read as flowing water.
        float ripple=sin(vWorld.z*.81-uTime*.54+sin(vWorld.x*.67)*1.1)
          *sin(vWorld.x*.96+uTime*.19);
        float curvedCurrent=sin(vUv.y*5.5-uTime*.43+sin(vUv.x*3.8+vUv.y*.9)*1.3);
        float currentStreak=smoothstep(.79,.98,curvedCurrent)*(.4+.6*deep);
        day+=vec3(.045,.059,.052)*smoothstep(.67,.96,ripple);
        day+=vec3(.037,.053,.05)*currentStreak;
        vec3 night=mix(vec3(.065,.235,.30),vec3(.23,.35,.43),fresnel);
        float coast=20.8+2.85*sin(vWorld.x*.075)+1.35*sin(vWorld.x*.19+1.3)
          +.38*sin(vWorld.x*.46-.7)+1.5*exp(-pow((vWorld.x+19.0)/7.0,2.0));
        // Blend fully into the reflective sea before the river ribbon leaves
        // dry land; no tinted rectangular patch remains in open water.
        float mouthFade=1.0-smoothstep(coast-9.0,coast+.2,vWorld.z);
        float softBank=smoothstep(.0,.115,bankDistance);
        gl_FragColor=vec4(mix(day,night,uNight),.88*mouthFade*softBank);
      }
    `,
  });
  let sea=null;
  return {
    river,
    createSea(geometry){
      sea=new Water(geometry,{
        textureWidth:512,textureHeight:512,
        waterNormals:normalTexture,
        sunDirection:new THREE.Vector3(-.35,.86,.37).normalize(),
        sunColor:'#ead8ba',waterColor:'#638e96',
        distortionScale:.85,alpha:1,fog:false,
      });
      sea.name='keynlock-reflective-sea';
      sea.userData.waterSurface=true;
      sea.material.transparent=true;
      sea.material.depthWrite=false;
      sea.material.uniforms.size.value=.78;
      sea.material.uniforms.uNight={value:0};
      enhanceOcean(sea);
      // Outlines use a second, normal-only render. Reflection is only needed in color passes.
      const reflect=sea.onBeforeRender;
      sea.onBeforeRender=function(renderer,scene,camera,...rest){
        if(scene.overrideMaterial)return;
        if(!reflectionGate.shouldRender(camera,performance.now()))return;
        return reflect.call(this,renderer,scene,camera,...rest);
      };
      return sea;
    },
    get sea(){return sea;},
    setView(eye){uEye.value.copy(eye);},
    setTime(value){
      uTime.value=value;
      if(sea)sea.material.uniforms.time.value=value;
    },
    setTimeOfDay(time){
      if(time!==lastTimeOfDay){reflectionGate.invalidate();lastTimeOfDay=time;}
      const mood={day:0,dusk:.32,night:1}[time]??0;
      uNight.value=mood;
      if(!sea)return;
      const palette={
        day:['#638e96','#ead8ba'],
        dusk:['#64858e','#d3a385'],
        night:['#35566a','#819cb4'],
      }[time]||['#638e96','#ead8ba'];
      sea.material.uniforms.waterColor.value.set(palette[0]);
      sea.material.uniforms.sunColor.value.set(palette[1]);
      sea.material.uniforms.uNight.value=mood;
    },
    dispose(){
      normalTexture.dispose();
      river.dispose();
      if(sea){sea.material.dispose();sea.userData.reflectionTarget?.dispose();}
    },
  };
}
