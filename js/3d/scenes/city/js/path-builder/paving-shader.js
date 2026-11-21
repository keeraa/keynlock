// The path atlas resolves shape, curves and kerbs at 1.25 pixels per metre.
// The reusable 360px cobblestone tile resolves pigment at 12 px per metre.
// Only its UVs repeat, so stone detail does not consume world-sized textures.
import {PAVING_BASE_COLOR,PAVING_MAP,PAVING_STONE_SIZE} from './paving-art.js';
import {WATER_CUTOUT_THRESHOLD} from './water-bed-cutout.js';

const VERTEX=`varying vec2 vUv;
  void main(){
    vUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }`;

const COLORIZE=`uniform sampler2D uStones;
  uniform sampler2D uReveal;
  uniform vec3 uBasePigment;
  uniform vec2 uStoneRepeats;
  #ifdef USE_WATER_MASK
  uniform sampler2D uWaterMask;
  #endif
  varying vec2 vUv;
  vec4 paintPaving(vec4 pigment,float coverageScale){
    // Independently of the alpha-cut canvas atlas, forbid every fragment of
    // the terrain-following road mesh where an opaque river is visible. This
    // also catches the interpolated triangles at steep shorelines.
    #ifdef USE_WATER_MASK
    if(texture2D(uWaterMask,vUv).a > ${WATER_CUTOUT_THRESHOLD})discard;
    #endif
    if(pigment.a<0.006)discard;
    // Green stores the antialiased paving mask. This is stable even when the
    // entire road is only two pixels across in the large city atlas.
    float inside=texture2D(uReveal,vUv).g*coverageScale;
    vec3 stones=texture2D(uStones,vUv*uStoneRepeats).rgb;
    // The atlas already contains 'inside * flatMortar'. Replace precisely
    // that contribution with 'inside * stones', preserving the drawn kerbs.
    pigment.rgb=clamp(pigment.rgb+inside*(stones-uBasePigment),0.0,1.0);
    return pigment;
  }`;

const STATIC_FRAGMENT=`uniform sampler2D uFinal;
  ${COLORIZE}
  void main(){
    gl_FragColor=paintPaving(texture2D(uFinal,vUv),1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const ANIMATION_FRAGMENT=`uniform sampler2D uBefore,uFinal;
  uniform float uProgress;
  ${COLORIZE}
  void main(){
    vec4 previous=texture2D(uBefore,vUv);
    vec4 finalColor=texture2D(uFinal,vUv);
    float arrival=texture2D(uReveal,vUv).r;
    float visible=uProgress>=1.0?1.0:smoothstep(arrival-0.018,arrival+0.018,uProgress);
    // Newly painted streets must emerge with their pigment rather than gain
    // fully opaque stones while the rest of the street is still fading in.
    float oldShare=clamp(previous.a/max(finalColor.a,0.001),0.0,1.0);
    gl_FragColor=paintPaving(mix(previous,finalColor,visible),mix(oldShare,1.0,visible));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createPavingMaterials(THREE,{finalTexture,beforeTexture,revealTexture,stoneTexture,
  waterMaskTexture=null}){
  const repeats=new THREE.Vector2(PAVING_MAP.width/PAVING_STONE_SIZE.tileMetres,
    PAVING_MAP.depth/PAVING_STONE_SIZE.tileMetres);
  const common=()=>({
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
    ...(waterMaskTexture?{defines:{USE_WATER_MASK:1}}:{}),
    vertexShader:VERTEX,
  });
  const shared={uFinal:{value:finalTexture},uReveal:{value:revealTexture},
    uStones:{value:stoneTexture},uStoneRepeats:{value:repeats},
    uBasePigment:{value:new THREE.Color(PAVING_BASE_COLOR)},
    ...(waterMaskTexture?{uWaterMask:{value:waterMaskTexture}}:{})};
  const material=new THREE.ShaderMaterial({...common(),uniforms:shared,fragmentShader:STATIC_FRAGMENT});
  const animationMaterial=new THREE.ShaderMaterial({...common(),uniforms:{
    ...shared,uBefore:{value:beforeTexture},uProgress:{value:1},
  },fragmentShader:ANIMATION_FRAGMENT});
  return {material,animationMaterial};
}
