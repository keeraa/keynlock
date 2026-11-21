import {bridgeDeckHeight} from './landscape-model.js';
import {KEYNLOCK_WATER_LEVEL} from './keynlock-geography.js';
import {createBridgeCobbleDeck,createBridgeDeckSlab} from './bridge-deck.js';

// Permanent river crossings have several open stone arches and a broad deck.
// One extruded shell per bridge keeps even a 300-metre crossing inexpensive.
export function grandBridgeArchCount(span){
  return Math.max(3,Math.min(10,Math.round(span/32)));
}

export function createGrandBridge(THREE,profile,sharedTexture=null,roadMaterial=null){
  const root=new THREE.Group();root.name='Кийенлок · большой многопролётный мост';
  const {span,deckWidth}=profile,half=span/2,arches=grandBridgeArchCount(span);
  const stone=new THREE.MeshStandardMaterial({color:'#cfc2a3',map:sharedTexture,roughness:1,
    metalness:0,side:THREE.DoubleSide});
  const deckStone=new THREE.MeshStandardMaterial({color:'#e3d6b9',map:sharedTexture,roughness:1,
    metalness:0,side:THREE.DoubleSide});
  const materials=[stone,deckStone],geometries=[];
  const add=(geometry,material,name)=>{
    geometries.push(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.noOutline=true;
    root.add(mesh);return mesh;
  };
  const deckAt=x=>bridgeDeckHeight(profile,x);
  const samples=Math.max(48,Math.ceil(span/2));
  const floor=KEYNLOCK_WATER_LEVEL-1.6,shape=new THREE.Shape();
  shape.moveTo(-half,floor);shape.lineTo(-half,deckAt(-half)-.22);
  for(let i=1;i<=samples;i++){
    const x=-half+span*i/samples;shape.lineTo(x,deckAt(x)-.22);
  }
  shape.lineTo(half,floor);
  const bay=span/arches,pier=2.25;
  for(let arch=arches-1;arch>=0;arch--){
    const left=-half+arch*bay,right=left+bay;
    const innerRight=right-pier/2,innerLeft=left+pier/2;
    const center=(innerRight+innerLeft)/2,radius=(innerRight-innerLeft)/2;
    const opening=Math.max(.65,deckAt(center)-floor-.52);
    shape.lineTo(innerRight,floor);
    for(let i=0;i<=18;i++){
      const t=Math.PI*i/18;
      shape.lineTo(center+radius*Math.cos(t),floor+.08+opening*Math.sin(t));
    }
    shape.lineTo(left,floor);
  }
  shape.closePath();
  const shellDepth=deckWidth-.75;
  const shell=add(new THREE.ExtrudeGeometry(shape,{depth:shellDepth,steps:1,
    bevelEnabled:false,curveSegments:8}),stone,'Пять или больше открытых каменных арок');
  shell.position.z=-shellDepth/2;
  const slab=add(createBridgeDeckSlab(THREE,profile),deckStone,
    'Цельная каменная плита под мостовой');
  slab.position.z=-(deckWidth-.12)/2;

  // Broad paving surface follows the gentle camber without stretched stones.
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=samples;i++){
    const x=-half+span*i/samples,y=deckAt(x)+.035;
    for(const z of [-deckWidth/2,deckWidth/2]){
      positions.push(x,y,z);uvs.push((x+half)*.32,(z+deckWidth/2)*.32);
    }
  }
  for(let i=0;i<samples;i++){
    const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);
  }
  const pavement=new THREE.BufferGeometry();
  pavement.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  pavement.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  pavement.setIndex(indices);pavement.computeVertexNormals();
  add(pavement,deckStone,'Широкая мощёная проезжая часть');
  if(roadMaterial){
    const cobbles=add(createBridgeCobbleDeck(THREE,profile),roadMaterial,
      'Брусчатка дороги на мосту');
    cobbles.castShadow=false;
  }

  // Stone parapets, joined across the complete bridge and on both sides.
  for(const side of [-1,1]){
    const barrier=new THREE.Shape();
    for(let i=0;i<=samples;i++){
      const x=-half+span*i/samples,y=deckAt(x)+.07;
      if(i===0)barrier.moveTo(x,y);else barrier.lineTo(x,y);
    }
    for(let i=samples;i>=0;i--){
      const x=-half+span*i/samples;
      barrier.lineTo(x,deckAt(x)+.92);
    }
    barrier.closePath();
    const rail=add(new THREE.ExtrudeGeometry(barrier,{depth:.43,bevelEnabled:false}),
      stone,'Каменный парапет');
    rail.position.z=side*(deckWidth/2-.22)-(side<0?.43:0);
  }

  // Four heavier entrance posts make a major river crossing recognizable at
  // city-scale zoom without attaching thousands of separate paving meshes.
  const postGeometry=new THREE.BoxGeometry(1.5,1.35,1.6);
  geometries.push(postGeometry);
  const posts=new THREE.InstancedMesh(postGeometry,deckStone,4);
  const dummy=new THREE.Object3D();let post=0;
  for(const x of [-half+2.1,half-2.1])for(const side of [-1,1]){
    dummy.position.set(x,deckAt(x)+.75,side*(deckWidth/2-.2));
    dummy.updateMatrix();posts.setMatrixAt(post++,dummy.matrix);
  }
  posts.instanceMatrix.needsUpdate=true;
  posts.castShadow=true;posts.receiveShadow=true;posts.userData.noOutline=true;
  root.add(posts);

  root.position.set(profile.x,0,profile.z);
  root.rotation.y=-Math.atan2(profile.dirZ,profile.dirX);
  root.userData={...profile,type:'fixed-grand-bridge'};
  return {group:root,dispose(){root.parent?.remove(root);
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(material=>material.dispose());}};
}
