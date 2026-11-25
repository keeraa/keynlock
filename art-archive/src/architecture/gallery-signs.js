import {entranceFront,entrancePaintColor} from './entrance-junction.js';
import {createArchOrnament} from './arch-ornament.js';

export function buildGallerySigns(context,{h,g,junctions}){
 const {THREE,layout,ceilingHeight,height,vaultRise,w,m,disposable,mesh,sign}=context;
 const tint=entrancePaintColor(THREE,h.color);
 const color=new THREE.MeshBasicMaterial({color:tint,map:m.wood.map??null,side:THREE.DoubleSide});
 const glow={value:0};
 context.hallGlows.set(h.id,glow);
 if(!context.archOrnament){
  context.archOrnament=createArchOrnament(THREE);
  disposable.add(context.archOrnament);
 }
 color.customProgramCacheKey=()=> 'gallery-painted-scrollwork';
 color.onBeforeCompile=shader=>{
  shader.uniforms.archiveArchOrnament={value:context.archOrnament};
  shader.uniforms.archiveArchGlow=glow;
  shader.vertexShader='varying vec2 vArchiveArch;\n'+shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvArchiveArch=uv;');
  shader.fragmentShader='uniform sampler2D archiveArchOrnament; uniform float archiveArchGlow; varying vec2 vArchiveArch;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec3 grain=texture2D(map,vec2(vArchiveArch.x*.76,vArchiveArch.y*.29)).rgb;
    float value=dot(grain,vec3(.2126,.7152,.0722));
    diffuseColor.rgb*=.90+.19*smoothstep(.025,.42,value);
   #endif
   float ornament=texture2D(archiveArchOrnament,vArchiveArch).a*step(0.,vArchiveArch.y);
   vec3 gilt=mix(diffuseColor.rgb,vec3(.83,.65,.36),.56);
   diffuseColor.rgb=mix(diffuseColor.rgb,gilt,ornament*.79);
   diffuseColor.rgb+=vec3(.98,.63,.18)*ornament*archiveArchGlow;
  `);
 };
 disposable.add(color);
 const arch=new THREE.Group();arch.name='category-arch:'+h.id;g.add(arch);
 const half=w/2-.14,width=.20;
 const radius=w/2,joinX=-half+.48;
 const yAt=x=>height+vaultRise*Math.sqrt(1-(x/radius)**2)+.045;
 const slopeAt=x=>-vaultRise*x/(radius*Math.sqrt(radius*radius-x*x));
 const joinY=yAt(joinX),springY=joinY-.52;
 // Match the vertical jamb at one end and the vault tangent at the other.
 const shoulder=new THREE.CubicBezierCurve(
  new THREE.Vector2(-half,springY),new THREE.Vector2(-half,springY+.28),
  new THREE.Vector2(joinX-.17,joinY-.17*slopeAt(joinX)),new THREE.Vector2(joinX,joinY)
 );
 const band=(x,y,dx,dy)=>{
  const scale=width/Math.hypot(dx,dy);
  return {inner:[x+dy*scale,y-dx*scale],outer:[x,y]};
 };
 const [innerX,innerY]=band(joinX,joinY,1,slopeAt(joinX)).inner;
 const innerShoulder=new THREE.CubicBezierCurve(
  new THREE.Vector2(-half+width,springY),new THREE.Vector2(-half+width,springY+.19),
  new THREE.Vector2(innerX-.13,innerY-.13*slopeAt(joinX)),new THREE.Vector2(innerX,innerY)
 );
 const shoulderBand=(t,side)=>{
  const p=shoulder.getPoint(t),inner=innerShoulder.getPoint(t);
  // Cover the return where the flat wall meets the curved drum.
  return {outer:[side*(p.x-.12*Math.sin(Math.PI*t)**2),p.y],inner:[side*inner.x,inner.y]};
 };
 const shoulderSteps=24,points=[band(-half,0,0,1)];
 for(let i=0;i<shoulderSteps;i++){
  points.push(shoulderBand(i/shoulderSteps,1));
 }
 for(let i=0;i<=48;i++){
  const x=joinX*(1-2*i/48);
  points.push(band(x,yAt(x),1,slopeAt(x)));
 }
 for(let i=shoulderSteps-1;i>=0;i--){
  points.push(shoulderBand(i/shoulderSteps,-1));
 }
 points.push(band(half,0,0,-1));
 const positions=[],uv=[],indices=[];
 let length=0;
 for(const [i,{inner,outer}] of points.entries()){
  if(i)length+=Math.hypot(outer[0]-points[i-1].outer[0],outer[1]-points[i-1].outer[1]);
  // The coloured face sits just in front of the projecting plinth cap.
  for(const offset of [-.125,.235]){
   for(const [j,[x,y]] of [inner,outer].entries()){
    positions.push(x,y,entranceFront(layout,h,x,junctions)+offset);
    uv.push(length/.82,j);
   }
  }
 }
 // Separate the face and edge UVs so the scrollwork never stretches across the thickness.
 const faceVertices=positions.length/3;
 positions.push(...positions);
 for(let i=0;i<faceVertices;i++)uv.push(uv[i*2],-1+(i%4>=2?.37:0));
 for(let i=0;i<points.length-1;i++){
  for(const [a,b] of [[0,1],[3,2]]){
   const k=i*4;
   indices.push(k+a,k+b,k+a+4,k+b,k+b+4,k+a+4);
  }
  for(const [a,b] of [[1,3],[2,0]]){
   const k=faceVertices+i*4;
   indices.push(k+a,k+b,k+a+4,k+b,k+b+4,k+a+4);
  }
 }
 const first=faceVertices,last=faceVertices+(points.length-1)*4;
 indices.push(first,first+2,first+1,first+1,first+2,first+3,last,last+1,last+2,last+1,last+3,last+2);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const surround=mesh(geometry,color,arch);
 surround.name='entrance-surround';surround.userData.skipStaticBatch=true;

 // The decorative shoulder rounds in sooner than the vault. Close the small
 // area behind that curve with a painted return tucked into the back of the trim.
 const shoulderFill=[],fillUV=[],fillIndices=[];
 for(const side of [-1,1]){
  const start=shoulderFill.length/3;
  for(let i=0;i<=shoulderSteps;i++){
   const {outer,inner}=shoulderBand(i/shoulderSteps,-side);
   const x=outer[0]+(inner[0]-outer[0])*.56;
   const lower=outer[1]+(inner[1]-outer[1])*.56,front=entranceFront(layout,h,x,junctions);
   for(const z of [front+.10,front+.26])for(const y of [lower,Math.max(lower+.01,yAt(x)+.008)]){
    shoulderFill.push(x,y,z);fillUV.push(x/3.5,y/3.5);
   }
  }
  for(let i=0;i<shoulderSteps;i++)for(const [a,b] of [[0,1],[1,3],[3,2],[2,0]]){
   const k=start+i*4;
   if(side===1)fillIndices.push(k+a,k+b,k+a+4,k+b,k+b+4,k+a+4);
   else fillIndices.push(k+b,k+a,k+a+4,k+b+4,k+b,k+a+4);
  }
 }
 const fill=new THREE.BufferGeometry();
 fill.setAttribute('position',new THREE.Float32BufferAttribute(shoulderFill,3));
 fill.setAttribute('uv',new THREE.Float32BufferAttribute(fillUV,2));
 fill.setIndex(fillIndices);fill.computeVertexNormals();
 const reveal=new THREE.MeshBasicMaterial({color:tint,side:THREE.DoubleSide});
 disposable.add(reveal);
 mesh(fill,reveal,g).name='entrance-shoulder-reveal';

 sign(h.title,0,ceilingHeight+1.45,layout.ringRadius-.10,Math.PI,1.95,g,layout.ringRadius-.10,tint).name='entrance-sign';
}
