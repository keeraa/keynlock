// A batch of projected soft edges. Each quad carries its own size and opacity.
export function createDecalGeometry(THREE){
 const positions=[],uv=[],extent=[],indices=[];
 return {
  get count(){return indices.length;},
  add({x,y,z,u,v,width,height,feather,opacity}){
   const first=positions.length/3;
   const w=width/2,h=height/2;
   for(const [i,j] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
    const a=i*(w+feather),b=j*(h+feather);
    positions.push(x+u[0]*a+v[0]*b,y+u[1]*a+v[1]*b,z+u[2]*a+v[2]*b);
    uv.push(a,b);extent.push(w,h,feather,opacity);
   }
   indices.push(first,first+1,first+2,first,first+2,first+3);
  },
  build(){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geometry.setAttribute('decalShape',new THREE.Float32BufferAttribute(extent,4));
   geometry.setIndex(indices);
   return geometry;
  },
 };
}

export function createDecalMaterial(THREE,{color,light=false}){
 return new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,toneMapped:false,
  blending:light?THREE.AdditiveBlending:THREE.NormalBlending,
  uniforms:{decalColor:{value:new THREE.Color(color)}},
  vertexShader:`
   attribute vec4 decalShape;
   varying vec2 vPosition;
   varying vec4 vShape;
   void main(){
    vPosition=uv;vShape=decalShape;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
   }`,
  fragmentShader:`
   uniform vec3 decalColor;
   varying vec2 vPosition;
   varying vec4 vShape;
   void main(){
    ${light?`
     float spread=length(vPosition/(vShape.xy+vec2(vShape.z)));
     float fade=1.0-smoothstep(.05,1.0,spread);
     float alpha=vShape.w*fade*fade;
    `:`
     vec2 q=abs(vPosition)-vShape.xy;
     float distance=length(max(q,0.0))+min(max(q.x,q.y),0.0);
     float alpha=vShape.w*(1.0-smoothstep(-vShape.z*.35,vShape.z,distance));
    `}
    gl_FragColor=vec4(decalColor,alpha);
    #include <colorspace_fragment>
   }`,
 });
}
