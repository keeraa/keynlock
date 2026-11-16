/** Reusable miniature industrial display pieces for chapter puzzle scenes. */
export function createWorldPuzzleArt({THREE, RoundedBoxGeometry, document, materials}) {
  const owned = new Set();
  const palette = {
    plate: materials.dark,
    steel: materials.steel,
    brass: materials.brass,
    copper: materials.copper,
    shadow: materials.edge,
    key: materials.key,
    slot: materials.inner,
  };
  function remember(resource) { owned.add(resource); return resource; }
  function metal(color) {
    const value = materials.key.clone();
    value.color.setHex(color);
    value.metalness = .68;
    value.roughness = .41;
    return remember(value);
  }
  function box(parent, x, y, z, width, height, depth, material = palette.steel, radius = .035) {
    const geometry = remember(new RoundedBoxGeometry(width, height, depth, 3,
      Math.min(radius, width * .24, height * .24, depth * .40)));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, x, y, z, radius, height, material = palette.steel, segments = 18) {
    const mesh = new THREE.Mesh(remember(new THREE.CylinderGeometry(radius, radius, height, segments)), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function label(parent, text, x, y, z, width, height, options = {}) {
    const canvas = document.createElement('canvas');
    const dimensions = options.symbol ? 256 : 768;
    canvas.width = dimensions;
    canvas.height = options.symbol ? 256 : 176;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = options.color || '#ecd4a4';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const size = options.symbol ? 164 : 68;
    context.font = `${options.weight || '600'} ${size}px ${options.symbol ? '"Noto Sans Symbols 2", "Segoe UI Symbol", serif' : 'Georgia, serif'}`;
    context.fillText(String(text), canvas.width / 2, canvas.height / 2, canvas.width * .94);
    const texture = remember(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const mesh = new THREE.Mesh(remember(new THREE.PlaneGeometry(width, height)),
      remember(new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,
        side:THREE.DoubleSide,toneMapped:false})));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function frame(parent, chapterName) {
    box(parent, 0, 0, 0, 5.68, 3.45, .32, palette.plate, .15);
    box(parent, 0, 1.42, .20, 5.35, .18, .12, palette.brass, .05);
    box(parent, 0, -1.47, .20, 5.35, .12, .12, palette.shadow, .04);
    label(parent, chapterName, 0, 1.68, .28, 4.9, .27, {color:'#c9a46d'});
    for (const x of [-2.58,2.58]) for (const y of [-1.25,1.24]) {
      cylinder(parent,x,y,.21,.084,.045,palette.steel);
      box(parent,x,y,.252,.065,.012,.008,palette.shadow,.002);
    }
  }
  function interactivePlate(parent, index, x, y, width, height, symbol = '', config = {}) {
    const group = new THREE.Group();
    group.position.set(x,y,.34);
    group.userData.worldChoiceIndex = index;
    parent.add(group);
    const surface = metal(0x687a79);
    const face = box(group,0,0,0,width,height,.12,surface,.065);
    box(group,0,0,-.064,width*.94,height*.86,.03,palette.shadow,.03);
    const marking = symbol ? label(group,symbol,0,0,.085,width*.71,height*.78,
      {symbol:config.symbol !== false,color:config.color || '#f2dfb9'}) : null;
    return {group,face,material:surface,marking};
  }
  // Six segment profiles are the stepped/triangular contours from v372.
  function profileGeometry(pattern, width = 1.20) {
    const baseline = -.02, depth = .24;
    const shape = new THREE.Shape();
    const left = -width / 2, unit = width / pattern.length;
    shape.moveTo(left,baseline);
    pattern.forEach((type,index) => {
      const x = left + index * unit;
      const segment = [
        [[.16,0],[.16,.09],[.72,.09],[.72,0],[1,0]],
        [[.18,0],[.48,.21],[.76,0],[1,0]],
        [[.16,0],[.16,.18],[.46,.18],[.46,.07],[.78,.07],[.78,0],[1,0]],
        [[.12,0],[.29,.15],[.45,0],[.58,0],[.72,.18],[.86,0],[1,0]],
        [[.18,0],[.18,.08],[.38,.08],[.38,.24],[.67,.24],[.67,0],[1,0]],
        [[.16,0],[.32,.09],[.54,.09],[.54,.20],[.78,.20],[.78,0],[1,0]],
      ][type];
      for (const [delta, height] of segment) shape.lineTo(x + delta * unit, baseline + height);
    });
    shape.lineTo(width / 2,baseline - depth);
    shape.lineTo(left,baseline - depth);
    shape.closePath();
    return remember(new THREE.ExtrudeGeometry(shape,{depth:.052,bevelEnabled:true,
      bevelSize:.008,bevelThickness:.008,bevelSegments:2,curveSegments:3}));
  }
  function keyProfile(parent, pattern, x, y, z, scale = 1, material = palette.key) {
    const group = new THREE.Group();
    group.position.set(x,y,z);group.scale.setScalar(scale);
    const blade = new THREE.Mesh(profileGeometry(pattern),material);
    blade.castShadow = true;
    group.add(blade);
    const knob = new THREE.Mesh(remember(new THREE.TorusGeometry(.15,.047,8,24)),material);
    knob.position.set(-.71,-.14,.018);
    group.add(knob);
    parent.add(group);
    return group;
  }
  function spring(parent, x, y, z, width = .11, height = .72) {
    const points=[];
    for (let n=0;n<=80;n++) {
      const t=n/80;
      points.push(new THREE.Vector3(Math.cos(t*Math.PI*18)*width,
        (t-.5)*height,Math.sin(t*Math.PI*18)*width));
    }
    const mesh = new THREE.Mesh(remember(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),80,.025,6,false)),palette.steel);
    mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  function dispose() {
    for (const resource of owned) resource.dispose?.();
    owned.clear();
  }
  return {palette,box,cylinder,label,frame,metal,interactivePlate,keyProfile,spring,dispose};
}
