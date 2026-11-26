// Shared wood maps; a per-work attribute selects the mixed frame finish.
export const GOUACHE_STYLES = ['mixed', 'walnut', 'oak', 'ebony'];
const GRAIN_LEVELS={walnut:[.027,.065],oak:[.19,.40],ebony:[.010,.044]};

export function createGouache(THREE,loadingManager,wearTexture) {
  const loader = new THREE.TextureLoader(loadingManager);
  const textures = new Map();
  const uniforms = { archiveEasyMode:{value:true}, archivePigmentEnabled: { value: false }, archiveWood: { value: null }, archivePigment: { value: null }, archiveReady: { value: false } };
  uniforms.archiveMixed={value:false};
  for(const name of ['archiveOak','archiveEbony','archiveOakPigment','archiveEbonyPigment'])uniforms[name]={value:null};
  uniforms.archiveFrameFlash={value:new Float32Array(11)};
  uniforms.archiveGrainLevels={value:new Float32Array(GRAIN_LEVELS.walnut)};
  uniforms.archiveBackWear={value:wearTexture??null};
  let current, disposed = false;

  function setStyle(key) {
    if (!GOUACHE_STYLES.includes(key) || disposed) return;
    current = key;uniforms.archiveMixed.value=key==='mixed';uniforms.archiveReady.value=false;
    for(const style of key==='mixed'?['walnut','oak','ebony']:[key])loadStyle(style);
    activate();
  }
  function loadStyle(key){
    if (!textures.has(key)) {
      const pair = {};
      textures.set(key, pair);
      for (const kind of ['wood', 'pigment']) {
        const url = new URL('../../catalog/materials/' + key + '-' + kind + '.webp', import.meta.url);
        pair[kind] = loader.load(url.href, () => {
          pair[kind + 'Ready'] = true;
          if (!disposed) activate();
        });
        pair[kind].wrapS = pair[kind].wrapT = THREE.MirroredRepeatWrapping;
        pair[kind].anisotropy = 4;
        if (kind === 'wood') pair[kind].colorSpace = THREE.SRGBColorSpace;
      }
    }
  }
  function activate() {
    const key=current==='mixed'?'walnut':current,pair=textures.get(key);
    if (!pair?.woodReady || !pair?.pigmentReady) return;
    if(current==='mixed'){
      const oak=textures.get('oak'),ebony=textures.get('ebony');
      if(!oak?.woodReady||!oak?.pigmentReady||!ebony?.woodReady||!ebony?.pigmentReady)return;
      uniforms.archiveOak.value=oak.wood;uniforms.archiveEbony.value=ebony.wood;
      uniforms.archiveOakPigment.value=oak.pigment;uniforms.archiveEbonyPigment.value=ebony.pigment;
    }
    uniforms.archiveWood.value = pair.wood;
    uniforms.archiveGrainLevels.value.set(GRAIN_LEVELS[key]);
    uniforms.archivePigment.value = pair.pigment;
    uniforms.archiveReady.value = true;
  }
  function apply(material) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      const varyings='varying vec3 vArchiveSurface, vArchiveHallColor, vArchiveBack; varying float vArchiveFrameHall, vArchiveFrameStyle;\n';
      shader.vertexShader = 'attribute vec3 archiveSurface, archiveHallColor, archiveBack; attribute float archiveFrameHall, archiveFrameStyle;\n'+varyings+
        shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvArchiveSurface = archiveSurface; vArchiveHallColor=archiveHallColor; vArchiveFrameHall=archiveFrameHall; vArchiveBack=archiveBack; vArchiveFrameStyle=archiveFrameStyle;');
      shader.fragmentShader = 'uniform sampler2D archiveWood, archivePigment, archiveOak, archiveEbony, archiveOakPigment, archiveEbonyPigment, archiveBackWear; uniform bool archiveMixed, archiveReady, archivePigmentEnabled, archiveEasyMode; uniform vec2 archiveGrainLevels; uniform float archiveFrameFlash[11];\n'+varyings+
        shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          if (vArchiveSurface.z > .5) {
            bool rear=vArchiveBack.z>.5;
            vec2 faceUv=vArchiveBack.xy;
            vec2 woodUv=rear?faceUv*vec2(.87,.76)+vec2(.07,.12):vArchiveSurface.xy;
            vec3 wood=archiveReady ? texture2D(archiveWood,woodUv).rgb : diffuseColor.rgb;
            vec2 levels=archiveGrainLevels;
            if(archiveReady&&archiveMixed){
              if(vArchiveFrameStyle>1.5){wood=texture2D(archiveEbony,woodUv).rgb;levels=vec2(.010,.044);}
              else if(vArchiveFrameStyle>.5){wood=texture2D(archiveOak,woodUv).rgb;levels=vec2(.19,.40);}
            }
            float grain=dot(wood,vec3(.2126,.7152,.0722));
            float brush=archiveReady ? smoothstep(levels.x,levels.y,grain) : .44;
            diffuseColor.rgb=archiveEasyMode ? vArchiveHallColor*(.65+.80*brush) : wood;
            diffuseColor.rgb*=vArchiveSurface.z;
            if(rear){
              vec2 nearest=min(faceUv,1.-faceUv);
              float edge=1.-smoothstep(.008,.086,min(nearest.x,nearest.y));
              float scratch=texture2D(archiveBackWear,faceUv*vec2(.46,.44)+vec2(.02,.51)).a;
              float scuff=texture2D(archiveBackWear,faceUv.yx*vec2(.43,.47)+vec2(.54,.02)).a;
              float wear=max(edge*(.37+.43*brush),scratch*.62+scuff*.28);
              vec3 bareWood=mix(vec3(.19,.091,.042),vec3(.54,.34,.17),brush);
              diffuseColor.rgb=mix(diffuseColor.rgb,bareWood,.24+wear*.55);
            }
            diffuseColor.rgb+=vec3(.72,.45,.16)*archiveFrameFlash[int(vArchiveFrameHall+.5)];
          } else if (archiveReady && archivePigmentEnabled) {
            // Value-only brush contrast preserves the colours of the reproduction.
            float pigment = texture2D(archivePigment, vArchiveSurface.xy).r;
            if(archiveMixed){
              if(vArchiveFrameStyle>1.5)pigment=texture2D(archiveEbonyPigment,vArchiveSurface.xy).r;
              else if(vArchiveFrameStyle>.5)pigment=texture2D(archiveOakPigment,vArchiveSurface.xy).r;
            }
            pigment-=.44;
            diffuseColor.rgb *= 1.0 + 0.48 * pigment;
          }
          `);
    };
    material.customProgramCacheKey = () => 'archive-gouache-v8';
    return material;
  }
  return {setStyle, setEasyMode(enabled){uniforms.archiveEasyMode.value=Boolean(enabled);}, setPigment(enabled) { uniforms.archivePigmentEnabled.value = Boolean(enabled); },
    setFrameFlash(index,intensity){if(index>0)uniforms.archiveFrameFlash.value[index]=intensity;},apply, dispose() {
    disposed = true;
    for (const pair of textures.values()) { pair.wood.dispose(); pair.pigment.dispose(); }
    textures.clear();
  }};
}
