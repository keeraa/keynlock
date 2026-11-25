import {entranceFront} from './entrance-junction.js';
export function buildGalleryVault(context, {h,roof,end,junctions}){
 const {THREE,layout,m,w,len,vaultRise,height,disposable,mesh,tube}=context;
 const settings=context.config.building.diffuseCeiling??{};
 const paneLength=settings.paneLengthM??1.6;
 const firstCrossbar=(Math.ceil(layout.ringRadius/paneLength)+1)*paneLength;
 const halfWidth=Math.min(w*.35,(settings.widthM??3)/2),edge=Math.acos(halfWidth/(w/2));
 const angles=[...Array.from({length:25},(_,j)=>j/24*Math.PI),edge,Math.PI-edge].sort((a,b)=>a-b);
 const verts=[],uv=[],colors=[],plaster=[],glass=[],n=angles.length;
 for(let row=0;row<2;row++)for(const a of angles){
  const x=Math.cos(a)*w/2;
  verts.push(x,height+Math.sin(a)*vaultRise,row?end:entranceFront(layout,h,x,junctions));
  uv.push(a/Math.PI*w/4,row*len/4);
  // A subtle milk-glass gradient gives the broad luminous strip a soft edge.
  const shade=1-.045*Math.pow(Math.min(1,Math.abs(x)/halfWidth),2);
  colors.push(shade,shade,shade);
 }
 for(let j=0;j<n-1;j++){
  const middle=(angles[j]+angles[j+1])/2;
  const indices=middle>edge&&middle<Math.PI-edge?glass:plaster;
  indices.push(j,j+1,j+n,j+1,j+n+1,j+n);
 }
 function surface(indices){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const vaultMat=m.ivory.clone();vaultMat.side=THREE.DoubleSide;disposable.add(vaultMat);
 mesh(surface(plaster),vaultMat,roof).name='gallery-vault';
 if(!context.diffuserMaterial){
  context.diffuserMaterial=new THREE.MeshBasicMaterial({color:settings.color??'#d7e2df',vertexColors:true,side:THREE.DoubleSide,
   toneMapped:false,transparent:true,opacity:.58,depthWrite:false,forceSinglePass:true});
  context.diffuserMaterial.onBeforeCompile=shader=>{
   shader.uniforms.archiveFirstCrossbar={value:firstCrossbar/paneLength};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vOpalCoordinates;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOpalCoordinates=uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    uniform float archiveFirstCrossbar;
    varying vec2 vOpalCoordinates;
    float opalHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float opalNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(opalHash(i),opalHash(i+vec2(1,0)),f.x),mix(opalHash(i+vec2(0,1)),opalHash(i+vec2(1,1)),f.x),f.y);}
   `).replace('#include <color_fragment>',`#include <color_fragment>
    vec2 p=vOpalCoordinates,cell=fract(vec2(p.x*2.,p.y));
    float cloud=opalNoise(vec2(p.x*4.,p.y*.7));
    float frost=opalNoise(vec2(p.x*45.,p.y*20.));
    float across=min(cell.x,1.-cell.x);
    float along=p.y<archiveFirstCrossbar ? archiveFirstCrossbar-p.y : min(cell.y,1.-cell.y);
    float border=min(across,along);
    float edge=smoothstep(0.,.10,border);
    float grainFade=1.-smoothstep(.012,.04,max(fwidth(p.x),fwidth(p.y)));
    diffuseColor.rgb*=.79+.09*cloud+.055*edge+.012*(frost-.5)*grainFade;
    diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.92,.96,1.),diffuseColor.rgb,cloud*.7);
    diffuseColor.a*=.92+.12*cloud+.12*(1.-edge);
   `);
  };
  context.diffuserMaterial.customProgramCacheKey=()=> 'archive-opal-glass-v3';
  disposable.add(context.diffuserMaterial);
 }
 const glassGeo=surface(glass),glassUv=[];
 for(let i=0;i<verts.length;i+=3)glassUv.push((verts[i]+halfWidth)/(halfWidth*2),verts[i+2]/(settings.paneLengthM??1.6));
 glassGeo.setAttribute('uv',new THREE.Float32BufferAttribute(glassUv,2));glassGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const panel=mesh(glassGeo,context.diffuserMaterial,roof);panel.name='diffuse-ceiling';panel.userData.excludeFromInk=true;
 // The frosted pane keeps diffuse lighting in the gallery as the sky shows through.
 for(const x of [-halfWidth,halfWidth]){
  const y=height+Math.sqrt(1-(x/(w/2))**2)*vaultRise-.025;
  tube([new THREE.Vector3(x,y,Math.sqrt(layout.ringRadius**2-x*x)),new THREE.Vector3(x,y,end)],.04,m.gold,roof);
 }
 // Shallow bronze rebates divide the diffuser into real glass panes.
 for(let z=firstCrossbar;z<end-.1;z+=paneLength){
  const points=Array.from({length:9},(_,i)=>{const x=-halfWidth+2*halfWidth*i/8;return new THREE.Vector3(x,height+Math.sqrt(1-(x/(w/2))**2)*vaultRise-.045,z);});
  tube(points,.022,m.gold,roof).name='diffuser-crossbar';
 }
 tube([new THREE.Vector3(0,height+vaultRise-.045,layout.ringRadius),new THREE.Vector3(0,height+vaultRise-.045,end)],.022,m.gold,roof).name='diffuser-centerbar';
}
