// Each style is shared by the whole exhibition, including its overview atlas.
export const GOUACHE_STYLES = ['walnut', 'oak', 'ebony'];

export function createGouache(THREE) {
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  const uniforms = { archiveEasyMode:{value:false}, archivePigmentEnabled: { value: false }, archiveWood: { value: null }, archivePigment: { value: null }, archiveReady: { value: false } };
  let current, disposed = false;

  function setStyle(key) {
    if (!GOUACHE_STYLES.includes(key) || disposed) return;
    current = key;
    if (!textures.has(key)) {
      const pair = {};
      textures.set(key, pair);
      for (const kind of ['wood', 'pigment']) {
        const url = new URL('../../catalog/materials/' + key + '-' + kind + '.webp', import.meta.url);
        pair[kind] = loader.load(url.href, () => {
          pair[kind + 'Ready'] = true;
          if (!disposed && current === key) activate(pair);
        });
        pair[kind].wrapS = pair[kind].wrapT = THREE.MirroredRepeatWrapping;
        pair[kind].anisotropy = 4;
        if (kind === 'wood') pair[kind].colorSpace = THREE.SRGBColorSpace;
      }
    }
    activate(textures.get(key));
  }
  function activate(pair) {
    if (!pair.woodReady || !pair.pigmentReady) return;
    uniforms.archiveWood.value = pair.wood;
    uniforms.archivePigment.value = pair.pigment;
    uniforms.archiveReady.value = true;
  }
  function apply(material) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'attribute vec3 archiveSurface, archiveHallColor; varying vec3 vArchiveSurface, vArchiveHallColor;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvArchiveSurface = archiveSurface; vArchiveHallColor=archiveHallColor;');
      shader.fragmentShader = 'uniform sampler2D archiveWood, archivePigment; uniform bool archiveReady, archivePigmentEnabled, archiveEasyMode; varying vec3 vArchiveSurface, vArchiveHallColor;\n' +
        shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          if (archiveReady) {
            if (vArchiveSurface.z > 0.5) diffuseColor.rgb = texture2D(archiveWood, vArchiveSurface.xy).rgb;
            else if (archivePigmentEnabled) {
              float pigment = texture2D(archivePigment, vArchiveSurface.xy).r - 0.5;
              diffuseColor.rgb *= 1.0 + 0.10 * pigment;
            }
          }
          if(archiveEasyMode && vArchiveSurface.z>0.5){
            float grain=archiveReady ? dot(texture2D(archiveWood,vArchiveSurface.xy).rgb,vec3(.2126,.7152,.0722)) : .5;
            diffuseColor.rgb=vArchiveHallColor*(.85+.30*grain);
          }`);
    };
    material.customProgramCacheKey = () => 'archive-gouache-v2';
    return material;
  }
  return {setStyle, setEasyMode(enabled){uniforms.archiveEasyMode.value=Boolean(enabled);}, setPigment(enabled) { uniforms.archivePigmentEnabled.value = enabled; }, apply, dispose() {
    disposed = true;
    for (const pair of textures.values()) { pair.wood.dispose(); pair.pigment.dispose(); }
    textures.clear();
  }};
}
