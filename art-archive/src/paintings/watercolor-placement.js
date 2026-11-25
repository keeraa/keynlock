import {createWatercolorEffect,WATERCOLOR_PALETTE} from '../../vendor/sikisi/effect/watercolor/index.js';
import {frameDimensions} from '../../catalog/painting-geometry.js';

export const PLACEMENT_EFFECTS=['classic','paper','smoke','wash'];
const duration=2400;
const resolution=128;

export function paperPalette(THREE,hallColor){
  if(!hallColor || !/^#[0-9a-f]{6}$/i.test(hallColor))return WATERCOLOR_PALETTE;
  const {h,s,l}=new THREE.Color(hallColor).getHSL({},THREE.SRGBColorSpace);
  const shade=(hue,saturation,lightness)=>'#'+new THREE.Color()
    .setHSL(h+hue,saturation,lightness,THREE.SRGBColorSpace).getHexString();
  return [
    hallColor,
    shade(-.012,s*.88,Math.max(.22,l-.105)),
    shade(.018,s*.75,Math.min(.79,l+.17)),
    shade(-.028,Math.min(.82,s*1.12),Math.min(.73,l+.07)),
    shade(.029,s*.67,Math.min(.76,l+.12)),
    shade(-.13,s*.45,.65),
    shade(.15,s*.42,.68),
  ];
}

export function createWatercolorPlacement(THREE,scene,renderer,config){
  let runtime=null,blank=null,result=null,mesh=null,start=-Infinity,last=-Infinity;
  let pending=0,selected='classic',runtimeColor=null;
  const unsupported=new Set();
  function clear(){
    pending++;
    if(mesh){
      mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
      result.dispose();blank.dispose();mesh=blank=result=null;
    }
    runtime?.dispose();runtime=runtimeColor=null;
  }
  function setEffect(value){
    const next=PLACEMENT_EFFECTS.includes(value)?value:'classic';
    if(next===selected)return;
    clear();selected=next;
  }
  async function show(slot,now,hallColor){
    const mode=selected;
    if(mode==='classic'||!renderer?.isWebGLRenderer||unsupported.has(mode))return false;
    const color=mode==='paper'?hallColor??null:null;
    if(runtime && runtimeColor!==color)clear();
    const ticket=++pending;
    const size=frameDimensions(slot,config.paintings);
    const width=size.width+.86,height=size.height+(mode==='wash'?1.26:.86);
    try{
      if(!runtime){
        const created=await createWatercolorEffect({THREE,renderer,width:width*180,height:height*180,resolution,
          options:{appearance:mode,...(mode==='paper'?{substeps:3,emissionDuration:.95,palette:paperPalette(THREE,color)}:{pressureIterations:7})}});
        if(ticket!==pending){created.dispose();return true;}
        runtime=created;runtimeColor=color;
        const target=()=>new THREE.WebGLRenderTarget(320,320,{depthBuffer:false});
        blank=target();result=target();
        const material=new THREE.ShaderMaterial({
          uniforms:{blank:{value:blank.texture},paint:{value:result.texture},opacity:{value:0}},
          transparent:true,depthWrite:false,toneMapped:false,
          vertexShader:`varying vec2 paintUv;
            void main(){paintUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader:`varying vec2 paintUv;uniform sampler2D blank,paint;uniform float opacity;
            void main(){
              vec3 background=texture2D(blank,paintUv).rgb;
              // Recover pigment absorption from the two renders. Paper highlights
              // do not contribute color or opacity to the wall overlay.
              vec3 light=texture2D(paint,paintUv).rgb;
              vec3 absorption=max(vec3(0.),1.-light/max(background,vec3(.05)));
              float amount=max(max(absorption.r,absorption.g),absorption.b);
              vec2 edge=min(paintUv,1.-paintUv);
              float coverage=amount*smoothstep(.012,.065,amount)*smoothstep(0.,.07,min(edge.x,edge.y));
              if(coverage<.005)discard;
              vec3 color=1.-absorption/max(.001,amount);
              gl_FragColor=vec4(color,coverage*opacity);
              #include <colorspace_fragment>
            }`,
        });
        mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
        mesh.name='placement-watercolor';mesh.userData.atmosphere=true;mesh.userData.excludeFromInk=true;
        scene.add(mesh);
      }
      runtime.resize(width*180,height*180);
      runtime.clear();runtime.render(blank);
      const offsetY=mode==='wash'?.18:0;
      runtime.emitRect({x:.5,y:.5-offsetY/height,width:size.width/width,height:size.height/height,impact:1});
      const inset=size.depth*.32;
      mesh.position.set(slot.x-slot.normal.x*inset,config.building.floorElevation+slot.y-offsetY,slot.z-slot.normal.z*inset);
      mesh.rotation.y=Math.atan2(slot.normal.x,slot.normal.z);
      mesh.scale.set(width,height,1);
      mesh.visible=false;start=now;last=now-34;
      return true;
    }catch(error){
      if(ticket!==pending)return true;
      clear();unsupported.add(mode);
      console.warn('Watercolor placement unavailable:',error);
      return false;
    }
  }
  function update(now){
    if(!runtime||now-last<1000/30)return;
    const elapsed=now-start;
    if(elapsed>=duration){mesh.visible=false;return;}
    const dt=Math.min(.035,(now-last)/1000);
    last=now;
    runtime.step(dt);
    runtime.render(result);
    mesh.material.uniforms.opacity.value=Math.min(1,elapsed/140,Math.max(0,(duration-elapsed)/650));
    mesh.visible=true;
  }
  return {setEffect,show,update,dispose:clear};
}
