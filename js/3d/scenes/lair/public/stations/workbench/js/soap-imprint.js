import {keyImprintContours} from './key-imprint-contours.js';

const WIDTH=2.91;
const HEIGHT=.88;
const TOP_Z=.225;
const FLOOR_Z=.103;
const BACK_Z=.042;

const makePath=(THREE,points,asShape=false)=>{
  const path=asShape?new THREE.Shape():new THREE.Path();
  path.moveTo(...points[0]);
  for(const p of points.slice(1))path.lineTo(...p);
  path.closePath();return path;
};

function wallGeometry(THREE,contour,topZ,bottomZ){
  const triangles=[];
  const vertex=(p,z)=>triangles.push(p[0],p[1],z);
  for(let i=1;i<contour.length;i++){
    const a=contour[i-1],b=contour[i];
    vertex(a,topZ);vertex(a,bottomZ);vertex(b,topZ);
    vertex(b,topZ);vertex(a,bottomZ);vertex(b,bottomZ);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function soapImprintContours(THREE,targets){
  const contours=keyImprintContours(THREE,targets);
  const points=contours.flat();
  const x0=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2;
  const y0=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2;
  return contours.map(contour=>contour.map(([x,y])=>[(x-x0)*.53,(y-y0)*.53]));
}

// The soap is modeled as a solid slab with a REAL key-shaped hollow: the
// surface around the impression is triangulated around an opening, while the
// floor and the inner wall of the keyring hole sit at different depths.
export function createSoapImpression(THREE,targets){
  const group=new THREE.Group();
  group.name='soap-key-impression';
  const [outline,hole]=soapImprintContours(THREE,targets);
  const outerRect=[[-WIDTH/2,-HEIGHT/2],[WIDTH/2,-HEIGHT/2],
    [WIDTH/2,HEIGHT/2],[-WIDTH/2,HEIGHT/2]];
  const solid=new THREE.MeshStandardMaterial({color:0xd8dec9,roughness:.97,metalness:0,
    side:THREE.DoubleSide});
  const cutWall=new THREE.MeshStandardMaterial({color:0x8f9b8b,roughness:.99,
    side:THREE.DoubleSide});
  const floorMaterial=new THREE.MeshStandardMaterial({color:0xb3bcaa,roughness:1,
    side:THREE.DoubleSide});
  const meshes=[];
  function add(geometry,material,z=0){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;
    mesh.castShadow=true;mesh.receiveShadow=true;
    group.add(mesh);meshes.push(mesh);return mesh;
  }

  // A little mass below the hollow gives the impression believable thickness.
  const solidTop=FLOOR_Z-.006;
  add(new THREE.BoxGeometry(WIDTH,HEIGHT,solidTop-BACK_Z),solid,
    (solidTop+BACK_Z)/2);
  const top=makePath(THREE,outerRect,true);
  top.holes.push(makePath(THREE,outline));
  add(new THREE.ShapeGeometry(top),solid,TOP_Z);
  const cavity=makePath(THREE,[...outline].reverse(),true);
  cavity.holes.push(makePath(THREE,[...hole].reverse()));
  add(new THREE.ShapeGeometry(cavity),floorMaterial,FLOOR_Z);
  // Soap remains raised inside the round opening of the pressed key bow.
  add(new THREE.ShapeGeometry(makePath(THREE,hole,true)),solid,TOP_Z);
  add(wallGeometry(THREE,outline,TOP_Z,FLOOR_Z),cutWall);
  add(wallGeometry(THREE,hole,TOP_Z,FLOOR_Z),cutWall);
  add(wallGeometry(THREE,[...outerRect,outerRect[0]],TOP_Z,BACK_Z),solid);

  // Worn, barely visible pressure line where the metal pressed into the soap.
  const lipGeometry=new THREE.BufferGeometry().setFromPoints(
    outline.map(([x,y])=>new THREE.Vector3(x,y,TOP_Z+.0008)));
  const lipMaterial=new THREE.LineBasicMaterial({color:0xa0aa9d,
    transparent:true,opacity:.52,depthWrite:false});
  const lip=new THREE.Line(lipGeometry,lipMaterial);group.add(lip);
  return {group,topZ:TOP_Z,floorZ:FLOOR_Z,dispose:()=>{
    for(const mesh of meshes){mesh.geometry.dispose();group.remove(mesh);}
    for(const material of [solid,cutWall,floorMaterial])material.dispose();
    lipGeometry.dispose();lipMaterial.dispose();group.remove(lip);
  }};
}
