import {entrancePaintColor} from './entrance-junction.js';

export function buildArchThreshold({THREE,w,m,mesh,disposable},{h,g,start}){
 const half=w/2-.14;
 const material=new THREE.MeshBasicMaterial({color:entrancePaintColor(THREE,h.color),map:m.wood.map??null});
 disposable.add(material);
 material.customProgramCacheKey=()=> 'archive-threshold-wear';
 material.onBeforeCompile=shader=>{
  shader.uniforms.archiveThresholdWear={value:m.wearTexture??null};
  shader.vertexShader='varying vec2 vThreshold;\n'+shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvThreshold=uv;');
  shader.fragmentShader='uniform sampler2D archiveThresholdWear; varying vec2 vThreshold;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 p=vThreshold;
   #ifdef USE_MAP
    vec3 wood=texture2D(map,vec2(p.x*3.2,p.y*.42)).rgb;
    diffuseColor.rgb*=.79+.35*smoothstep(.015,.37,dot(wood,vec3(.2126,.7152,.0722)));
   #endif
   float traffic=1.-smoothstep(.06,.46,abs(p.x-.5));
   vec2 marks=vec2(p.y*.43+.03,p.x*.42+.04);
   vec4 strokes=texture2D(archiveThresholdWear,marks);
   vec4 scuffs=texture2D(archiveThresholdWear,marks+vec2(.5,0.));
   float wear=(strokes.a*.64+scuffs.a*.36)*(.14+traffic*.77);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.52,.38,.23),wear*.62);
  `);
 };
 const profile=[[-.18,.006],[-.15,.047],[.15,.047],[.18,.006]],positions=[],uv=[],indices=[];
 for(const [z,y] of profile)for(const x of [-half,half]){
  positions.push(x,y,z+start);uv.push(.5+.5*x/half,.5+z/.36);
 }
 for(let row=0;row<3;row++){
  const first=row*2;indices.push(first,first+2,first+1,first+1,first+2,first+3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const threshold=mesh(geometry,material,g);threshold.name='arch-threshold';
 threshold.castShadow=false;
}
