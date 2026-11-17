export function createHousePrimitives({THREE,mats,roofSurfaceUV}) {
  function box(parent, size, pos, mat, extra={}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.castShadow = extra.cast !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, radius, height, pos, mat, sides=12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,sides),mat);
    mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    return mesh;
  }

  function beam(parent, start, end, thickness, material) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const mid = a.clone().add(b).multiplyScalar(.5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, a.distanceTo(b), thickness), material);
    mesh.position.copy(mid); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().sub(a).normalize());
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    return mesh;
  }

  function triangle(parent, points, mat) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geom.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));
    geom.computeVertexNormals();
    const mesh=new THREE.Mesh(geom,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }

  function roofSurface(parent, corners, face, uvSizing = {}) {
    const geom = new THREE.BufferGeometry();
    const coords=[],uv=[];
    const axis = face === 'end' ? 0 : 2;
    const horizontal = corners.map(point => point[axis]);
    const heights = corners.map(point => point[1]);
    const bounds = {
      minHorizontal: Math.min(...horizontal),
      maxHorizontal: Math.max(...horizontal),
      minY: Math.min(...heights),
      maxY: Math.max(...heights),
      referenceHorizontalSpan: uvSizing.horizontalSpan,
      slopeLength: uvSizing.slopeLength,
      referenceSlopeLength: uvSizing.referenceSlopeLength,
    };
    for(let i=1;i<corners.length-1;i++){
      for(const vertex of [corners[0],corners[i],corners[i+1]]){
        coords.push(...vertex);
        uv.push(...roofSurfaceUV(vertex,face,bounds));
      }
    }
    geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom,mats.roof);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.roofSurface=face;parent.add(mesh);
    return mesh;
  }

  return {box,cylinder,beam,triangle,roofSurface};
}
