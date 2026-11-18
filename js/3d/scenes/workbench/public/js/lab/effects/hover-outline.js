// Screen-space ribbons keep a selectable part's white contour genuinely thick
// on WebGL implementations that ignore LineBasicMaterial.linewidth.
export function createWideEdgeGeometry(THREE,source){
  const segments=source.getAttribute('position');
  const count=Math.floor(segments.count/2);
  const start=new Float32Array(count*12),end=new Float32Array(count*12);
  const position=new Float32Array(count*12),side=new Float32Array(count*4);
  const indices=new Uint32Array(count*6);
  for(let index=0;index<count;index++){
    const a=index*2,b=a+1;
    for(let corner=0;corner<4;corner++){
      const vertex=index*4+corner,offset=vertex*3;
      const current=corner<2?a:b;
      for(let axis=0;axis<3;axis++){
        start[offset+axis]=segments.array[a*3+axis];
        end[offset+axis]=segments.array[b*3+axis];
        position[offset+axis]=segments.array[current*3+axis];
      }
      side[vertex]=corner%2===0?1:-1;
    }
    const v=index*4,i=index*6;
    indices.set([v,v+1,v+2,v+2,v+1,v+3],i);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
  geometry.setAttribute('edgeStart',new THREE.BufferAttribute(start,3));
  geometry.setAttribute('edgeEnd',new THREE.BufferAttribute(end,3));
  geometry.setAttribute('edgeSide',new THREE.BufferAttribute(side,1));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createWideEdgeMaterial(THREE,viewport,opacity=0){
  return new THREE.ShaderMaterial({
    uniforms:{uViewport:{value:viewport},uWidth:{value:4.5},uOpacity:{value:opacity}},
    vertexShader:`
      attribute vec3 edgeStart;
      attribute vec3 edgeEnd;
      attribute float edgeSide;
      uniform vec2 uViewport;
      uniform float uWidth;
      void main(){
        vec4 clipStart=projectionMatrix*modelViewMatrix*vec4(edgeStart,1.0);
        vec4 clipEnd=projectionMatrix*modelViewMatrix*vec4(edgeEnd,1.0);
        vec2 direction=(clipEnd.xy/max(0.001,clipEnd.w)-
          clipStart.xy/max(0.001,clipStart.w))*uViewport;
        vec2 normal=length(direction)>0.0001?
          normalize(vec2(-direction.y,direction.x)):vec2(0.0,1.0);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_Position.xy+=normal*edgeSide*uWidth/
          max(uViewport,vec2(1.0))*gl_Position.w;
        // Lift just ahead of the metal surface to avoid flickering edges.
        gl_Position.z-=0.0015*gl_Position.w;
      }`,
    fragmentShader:`
      uniform float uOpacity;
      void main(){gl_FragColor=vec4(1.0,1.0,1.0,uOpacity);}
    `,
    transparent:true,depthTest:true,depthWrite:false,
    side:THREE.DoubleSide,toneMapped:false
  });
}

export function fadeOutline(current,target,dt){
  const value=current+(target-current)*(1-Math.exp(-Math.max(0,dt)*14));
  return Math.abs(value-target)<0.004?target:value;
}
