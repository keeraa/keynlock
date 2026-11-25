// Original painted surfaces from Keynlock Key Archive v122. One texture per URL.
export function createMaterials(THREE,loadingManager) {
 const loader=new THREE.TextureLoader(loadingManager),textures=new Map(),materials=new Set();
 const texture=(file)=>{if(!textures.has(file)){const t=loader.load(new URL('../../assets/'+file,import.meta.url).href);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.anisotropy=4;textures.set(file,t);}return textures.get(file);};
 const make=(color,file)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.98,map:file?texture(file):null});materials.add(m);return m;};
 const mat={
  plaster:make(0xe6dfd0,'gouache-archive-limewash-v8.webp'),
  ivory:make(0xf5e8cf,'gouache-archive-ivory-v3.webp'),
  wood:make(0xb8a18a,'gouache-archive-walnut-v5.webp'),
  darkWood:make(0x79614b,'gouache-archive-walnut-v5.webp'),
  floor:make(0xc4b095,'gouache-floor-walnut-v1.webp'),
  stone:make(0xc8bca2,'gouache-archive-ivory-v3.webp'),
  rug:make(0xb8a1a0,'gouache-carpet-plain-v4.webp'),
  gold:make(0xb99451),roof:make(0x59635d),exterior:make(0xb5b29c),garden:make(0x40584b),
  glass:new THREE.MeshPhysicalMaterial({color:0xc2e1e8,roughness:.08,metalness:0,clearcoat:1,clearcoatRoughness:.05,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}),
 };
 materials.add(mat.glass);
 const wallPlasters=new Set(),whiteFinish={value:false};
 const wearAtlas={value:texture('gouache-wear-atlas-v1.webp')};
 function addWallPlaster(material){
  wallPlasters.add(material);
  material.customProgramCacheKey=()=> 'archive-plaster-v3';
  material.onBeforeCompile=shader=>{
   shader.uniforms.archiveWhiteFinish=whiteFinish;
   shader.uniforms.archiveWallWear=wearAtlas;
   const varyings='varying vec3 vPlasterPosition, vPlasterNormal;\n';
   shader.vertexShader=varyings+shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvPlasterPosition=(modelMatrix*vec4(transformed,1.0)).xyz;vPlasterNormal=mat3(modelMatrix)*normal;');
   shader.fragmentShader=varyings+shader.fragmentShader.replace('#include <common>',`
    #include <common>
    uniform bool archiveWhiteFinish;
    uniform sampler2D archiveWallWear;
    vec3 archiveWearRandom(vec3 p) {
      p=fract(p*vec3(.1031,.1030,.0973));
      p+=dot(p,p.yxz+33.33);
      return fract((p.xxy+p.yzz)*p.zyx);
    }
    float archiveWearAt(vec2 plane,float depth) {
      vec2 grid=plane/vec2(2.35,1.65), cell=floor(grid);
      vec3 seed=archiveWearRandom(vec3(cell, floor(depth*.43)));
      vec2 p=fract(grid)-vec2(.5)-.26*(seed.xy-.5);
      float a=(seed.z-.5)*1.65;
      p=mat2(cos(a),sin(a),-sin(a),cos(a))*p;
      vec2 local=p/(.60+.28*seed.y)+.5;
      vec2 tile=vec2(step(.5,seed.x),step(.5,seed.y));
      vec4 wear=texture2D(archiveWallWear,(tile+clamp(local,.01,.99))*.5);
      return wear.a * (dot(wear.rgb,vec3(.2126,.7152,.0722))-.33)
        * smoothstep(.14,.52,seed.z);
    }`).replace(
    '#include <map_fragment>',`
    #ifdef USE_MAP
     if(archiveWhiteFinish){
      vec3 p=vPlasterPosition;
      vec2 a=vec2(p.x+.58*p.z,p.y+.30*p.z)*.37;
      vec2 b=vec2(p.z-.41*p.x,p.y+.27*p.x)*.53;
      a+=.11*sin(b.yx*1.7);
      b+=.13*cos(a.yx*1.4+vec2(.3,1.8));
      diffuseColor.rgb*=mix(texture2D(map,a).rgb,texture2D(map,b+vec2(.29,.67)).rgb,.48);
     }else{
      ${THREE.ShaderChunk.map_fragment}
     }
     vec3 p=vPlasterPosition;
     vec3 n=abs(normalize(vPlasterNormal));
     float major=smoothstep(-.32,.32,n.x-n.z);
     float wear=mix(archiveWearAt(p.xy,p.z),archiveWearAt(p.zy,p.x),major);
     diffuseColor.rgb*=1.+wear*.32*(1.-n.y);
    #endif`);
  };
 }
 addWallPlaster(mat.plaster);
 function setWallFinish(finish){
  const white=finish==='white';
  whiteFinish.value=white;
  const map=texture(white?'gouache-archive-whitewash.webp':'gouache-archive-limewash-v8.webp');
  for(const material of wallPlasters){
   material.color.setHex(white?0xffffff:0xe6dfd0);
   material.map=map;
  }
 }
 return {...mat,make,setWallFinish,addWallPlaster,wearTexture:wearAtlas.value,
  dispose(){for(const m of materials)m.dispose();for(const t of textures.values())t.dispose();},get textureCount(){return textures.size;}};
}
// Physical UV scale keeps the gouache brushwork consistent on narrow cornices.
export function metricBox(THREE,w,h,d,tile=3.5){
 const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv;
 const spans=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
 for(let face=0;face<6;face++)for(let j=0;j<4;j++){const i=face*4+j;uv.setXY(i,uv.getX(i)*spans[face][0]/tile,uv.getY(i)*spans[face][1]/tile);}
 return g;
}
