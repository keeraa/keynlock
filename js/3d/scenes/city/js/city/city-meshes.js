// Centralized city mesh batching and world-space surface merging.
export function createCityMeshes(ctx) {
  const {T,scene,materials,batches,surfaces,objects,geometries,heightAt,terrainSurfaceAt}=ctx;
  const yawQ=new T.Quaternion(),tiltQ=new T.Quaternion(),q=new T.Quaternion();
  const up=new T.Vector3(0,1,0),forward=new T.Vector3(0,0,1),right=new T.Vector3(1,0,0);
  function part(material,shape,x,y,z,sx,sy,sz,yaw=0,tilt=0,roll=0,ground=null) {
    const key=shape+'/'+material;
    if(!batches.has(key))batches.set(key,{shape,material,entries:[]});
    const entry=batches.get(key);
    yawQ.setFromAxisAngle(up,yaw);tiltQ.setFromAxisAngle(forward,tilt);
    q.copy(yawQ).multiply(tiltQ);
    if(roll)q.multiply(new T.Quaternion().setFromAxisAngle(right,roll));
    const matrix=new T.Matrix4().compose(new T.Vector3(x,y+(ground??heightAt(x,z)),z),q,new T.Vector3(sx,sy,sz));
    entry.entries.push(matrix);
  }
  function local(x,z,dx,dz,angle) {return [x+dx*Math.cos(angle)+dz*Math.sin(angle),z-dx*Math.sin(angle)+dz*Math.cos(angle)];}
  function collectSurface(geometry,material) {
    if(!surfaces.has(material))surfaces.set(material,[]);
    surfaces.get(material).push(geometry);
  }
  function ribbon(points,width,material,y,options={}) {
    const positions=[],uvs=[],index=[];
    const stonePattern=['road','cobble','paving','quay','stonePath'].includes(material);
    // Paved edges are straight. Their former random widths and averaged corner
    // normals made jagged wedges wherever two streets joined.
    const rough=stonePattern?0:(options.rough||0);
    const direction=(a,b)=>{
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
      return [-dz/length,dx/length];
    };
    const samples=[];
    if(points.length<2)return;
    samples.push({point:points[0],length:0,normal:direction(points[0],points[1])});
    let walked=0;
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1],[bx,bz]=points[i];
      const length=Math.hypot(bx-ax,bz-az);
      const steps=Math.max(1,Math.ceil(length/(stonePattern?.44:.75)));
      const normal=direction(points[i-1],points[i]);
      for(let j=1;j<=steps;j++){
        let cornerNormal=normal;
        if(j===steps&&i<points.length-1){
          const next=direction(points[i],points[i+1]);
          const dot=normal[0]*next[0]+normal[1]*next[1];
          const divisor=Math.max(.5,1+dot);
          cornerNormal=[(normal[0]+next[0])/divisor,(normal[1]+next[1])/divisor];
        }
        samples.push({point:[ax+(bx-ax)*j/steps,az+(bz-az)*j/steps],
          length:walked+length*j/steps,normal:cornerNormal});
      }
      walked+=length;
    }
    const across=options.crossSections??(stonePattern?Math.max(2,Math.ceil(width/.65)):1);
    for(let i=0;i<samples.length;i++) {
      const [nx,nz]=samples[i].normal;
      const [x,z]=samples[i].point;
      const actualWidth=options.widthAt?options.widthAt(x,z,samples[i].length/walked):width;
      const edge=actualWidth/2*(1+Math.sin(i*2.7)*rough);
      for(let j=0;j<=across;j++) {
        const side=1-2*j/across;
        const shift=options.centerOffsetAt?options.centerOffsetAt(x,z,samples[i].length/walked):0;
        const px=x+nx*(edge*side+shift),pz=z+nz*(edge*side+shift);
        const elevation=options.elevation?options.elevation(px,pz):y+(options.flat?0:terrainSurfaceAt(px,pz));
        positions.push(px,elevation,pz);
        // Paving uses one world-space stone course size on every lane.
        if(stonePattern)uvs.push(px/2.35,pz/5.2);
        else uvs.push(j/across,samples[i].length/5);
        if(i&&j<across){
          const a=(i-1)*(across+1)+j,b=i*(across+1)+j;
          index.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(index);geometry.computeVertexNormals();
    collectSurface(geometry,typeof material==='string'?materials.get(material):material);
  }
  function pavedRectangle(x,z,w,d,y=.049,material='road'){
    ribbon([[x-w/2,z],[x+w/2,z]],d,material,y);
  }
  function foundationDepth(x,z,halfX,halfZ){
    const center=heightAt(x,z);
    let lowest=center;
    for(const dx of [-halfX,0,halfX])for(const dz of [-halfZ,0,halfZ]){
      lowest=Math.min(lowest,heightAt(x+dx,z+dz));
    }
    // The stone plinth must reach the actual downhill surface at every corner.
    return Math.max(1.3,center-lowest+.65);
  }
  function finalize() {
    const targets=[];
    for(const batch of batches.values()) {
      if(!batch.entries.length)continue;
      const mesh=new T.InstancedMesh(geometries[batch.shape],materials.get(batch.material),batch.entries.length);
      mesh.name='city-'+batch.material;
      mesh.receiveShadow=true;
      // Screen-space depth contours already define small elements; sunlight shadows on
      // each window would double the draw cost without adding readable information.
      mesh.castShadow=['box','cylinder','tower'].includes(batch.shape) && !['windows','litWindow','iron','pale','roofTile'].includes(batch.material);
      mesh.frustumCulled=false;
      for(let i=0;i<batch.entries.length;i++)mesh.setMatrixAt(i,batch.entries[i]);
      mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);targets.push(mesh);
    }
    return targets;
  }

  function finalizeSurfaces(waterMats) {
    // Roads, painted shore and garden patches have world-space vertices and never move.
    // Combine them by material to avoid dozens of repeated color/normal/reflection draws.
    for(const [material,geometries] of surfaces) {
      let geometry=geometries[0];
      if(geometries.length>1) {
        const vertexCount=geometries.reduce((total,g)=>total+g.getAttribute('position').count,0);
        const indexCount=geometries.reduce((total,g)=>total+g.index.count,0);
        const positions=new Float32Array(vertexCount*3);
        const normals=new Float32Array(vertexCount*3);
        const uvs=new Float32Array(vertexCount*2);
        const indices=new (vertexCount>65535?Uint32Array:Uint16Array)(indexCount);
        let vertexOffset=0,indexOffset=0;
        for(const source of geometries) {
          const count=source.getAttribute('position').count;
          positions.set(source.getAttribute('position').array,vertexOffset*3);
          normals.set(source.getAttribute('normal').array,vertexOffset*3);
          uvs.set(source.getAttribute('uv').array,vertexOffset*2);
          const sourceIndices=source.index.array;
          for(let i=0;i<sourceIndices.length;i++)indices[indexOffset+i]=sourceIndices[i]+vertexOffset;
          indexOffset+=sourceIndices.length;
          vertexOffset+=count;
          source.dispose();
        }
        geometry=new T.BufferGeometry();
        geometry.setAttribute('position',new T.BufferAttribute(positions,3));
        geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
        geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));
        geometry.setIndex(new T.BufferAttribute(indices,1));
      }
      const mesh=new T.Mesh(geometry,material);
      mesh.name='city-merged-surface';mesh.receiveShadow=true;
      if(material===waterMats.river)mesh.userData.waterSurface=true;
      scene.add(mesh);objects.push(mesh);
    }
    surfaces.clear();
  }

  return {part,local,collectSurface,ribbon,pavedRectangle,foundationDepth,finalize,finalizeSurfaces};
}
