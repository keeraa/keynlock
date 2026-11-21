import {gouacheAssetUrl} from '../../modules/keynlock-materials/index.js';
import {bridgeDeckHeight,BRIDGE_BANK_OVERHANG} from './landscape-model.js';
import {createBridgeCobbleDeck,createBridgeDeckSlab} from './bridge-deck.js';

// A self-contained, reusable arched stone bridge. The same geometry works for
// narrow canals and wide rivers: its span is derived from the crossing width.
export function stoneBridgeDimensions(riverWidth){
  return {span:Math.max(10.4,riverWidth+BRIDGE_BANK_OVERHANG),width:3.75};
}

export function createStoneBridge(THREE,profile,sharedTexture=null,roadMaterial=null){
  const root=new THREE.Group();root.name='KEYNLOCK · каменный арочный мост';
  const {span,deckWidth}=profile;
  const stone=new THREE.MeshStandardMaterial({color:'#dbd0b2',map:sharedTexture,roughness:1,metalness:0,side:THREE.DoubleSide});
  const topstone=new THREE.MeshStandardMaterial({color:'#ded2ad',map:sharedTexture,roughness:1,metalness:0,side:THREE.DoubleSide});
  const carvedStone=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  const materials=[stone,topstone,carvedStone],geometries=[];
  const add=(geometry,material,parent=root)=>{
    geometries.push(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData.noOutline=true;parent.add(mesh);return mesh;
  };
  const floor=-Math.max(1.65,Math.min(7.4,(profile.depth??2.8)*.92));
  const archHalf=Math.min(span/2-1.15,profile.width*.5+.3);
  const archCrown=Math.min(bridgeDeckHeight(profile,0)-floor-.9,(profile.depth??2.8)*.9+.75);
  const shape=new THREE.Shape();
  shape.moveTo(-span/2,floor);
  shape.lineTo(-span/2,bridgeDeckHeight(profile,-span/2)-.06);
  const steps=Math.max(32,Math.ceil(span*1.7));
  for(let i=1;i<=steps;i++){
    const x=-span/2+i*span/steps;
    shape.lineTo(x,bridgeDeckHeight(profile,x)-.06);
  }
  shape.lineTo(span/2,floor);
  shape.lineTo(archHalf,floor);
  // One solid, continuous barrel vault: the river runs through its carved
  // opening. Formerly two separate end panels looked like three broken arches.
  for(let i=0;i<=48;i++){
    const x=archHalf-i*archHalf*2/48;
    shape.lineTo(x,floor+.12+archCrown*Math.sqrt(Math.max(0,1-(x/archHalf)**2)));
  }
  shape.lineTo(-span/2,floor);shape.closePath();
  const shellDepth=deckWidth-.18;
  const vault=add(new THREE.ExtrudeGeometry(shape,{depth:shellDepth,steps:1,
    bevelEnabled:false,curveSegments:10}),stone);
  vault.position.z=-shellDepth/2;
  vault.name='Цельный каменный арочный свод';
  const slab=add(createBridgeDeckSlab(THREE,profile),topstone);
  slab.position.z=-(deckWidth-.12)/2;
  slab.name='Цельная каменная плита под мостовой';
  // Individual arched voussoirs are joined in one mesh per face. Their
  // warm/cool stone colors and curved joints give the bridge a cut-stone arch.
  for(const side of [-1,1]){
    const vertices=[],colors=[],indices=[],count=26;
    const tones=['#d1c4a5','#e0d4b8','#bbb49e','#d5c8ab','#c5bda3'];
    for(let i=0;i<count;i++){
      const theta0=Math.PI*i/count+.009,theta1=Math.PI*(i+1)/count-.009;
      const vtx=(theta,outer)=>{
        const x=archHalf*Math.cos(theta)*(outer?1.077:1);
        const y=floor+.13+archCrown*Math.sin(theta)+(outer?.235:.012);
        vertices.push(x,y,side*(shellDepth/2+.018));
        const color=new THREE.Color(tones[i%tones.length]);
        colors.push(color.r,color.g,color.b);
      };
      const idx=vertices.length/3;
      vtx(theta0,false);vtx(theta0,true);vtx(theta1,false);vtx(theta1,true);
      indices.push(idx,idx+1,idx+2,idx+1,idx+3,idx+2);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry,carvedStone);
  }

  // The bowed deck is one continuous surface, allowing all bridge sizes to
  // inherit the same gouache stone treatment without hundreds of draw calls.
  const segments=Math.max(24,Math.round(span*3)),positions=[],uvs=[],indices=[];
  for(let i=0;i<=segments;i++){
    const x=-span/2+span*i/segments,y=bridgeDeckHeight(profile,x)+.03;
    for(const z of [-deckWidth/2,deckWidth/2]){
      positions.push(x,y,z);uvs.push((x+span/2)*.46,(z+deckWidth/2)*.5);
    }
  }
  for(let i=0;i<segments;i++){
    const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);
  }
  const deck=new THREE.BufferGeometry();deck.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  deck.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));deck.setIndex(indices);deck.computeVertexNormals();
  add(deck,topstone);

  if(roadMaterial){
    const road=add(createBridgeCobbleDeck(THREE,profile),roadMaterial);
    road.name='Брусчатка дороги на мосту';
    road.castShadow=false;
  }

  // Staggered individual paving stones, drawn as ONE instanced mesh. Subtle
  // variation breaks the mechanical striping seen on plain procedural decks.
  if(!roadMaterial){
    const courses=Math.max(9,Math.round(span/1.02)),lanes=4;
    const paverGeometry=new THREE.BoxGeometry(.96,.045,deckWidth/lanes-.045);
    const paverMaterial=new THREE.MeshStandardMaterial({color:'#ddd0b6',map:sharedTexture,roughness:1,metalness:0});
    materials.push(paverMaterial);geometries.push(paverGeometry);
    const pavers=new THREE.InstancedMesh(paverGeometry,paverMaterial,courses*lanes);
    const dummy=new THREE.Object3D();
    const tones=['#e4d8be','#d5cab2','#ddd3bf','#cec4ad','#d9ccb5','#d6ceb9'];
    for(let row=0;row<courses;row++)for(let lane=0;lane<lanes;lane++){
      const index=row*lanes+lane;
      const x=-span/2+(row+.5)*span/courses+((row*11+lane*7)%5-2)*.018;
      const z=(lane+.5)*deckWidth/lanes-deckWidth/2;
      dummy.position.set(x,bridgeDeckHeight(profile,x)+.08,z);
      // The blocks follow the camber of the arch; flat boxes used to float at
      // the approaches and sink through the stone sheet at the middle courses.
      const grade=(bridgeDeckHeight(profile,x+.12)-bridgeDeckHeight(profile,x-.12))/.24;
      dummy.rotation.z=Math.atan(grade);
      dummy.scale.set(Math.min(1,span/courses*.98),1,1);
      dummy.updateMatrix();pavers.setMatrixAt(index,dummy.matrix);
      pavers.setColorAt(index,new THREE.Color(tones[(row*3+lane*5)%tones.length]));
    }
    pavers.instanceMatrix.needsUpdate=true;pavers.instanceColor.needsUpdate=true;
    pavers.castShadow=false;pavers.receiveShadow=true;pavers.userData.noOutline=true;
    root.add(pavers);
  }

  // Cut-stone coping and a low parapet on either side: their heights follow
  // the entire arch rather than floating above the changing deck.
  for(const side of [-1,1]){
    const shape=new THREE.Shape();
    for(let i=0;i<=segments;i++){
      const x=-span/2+span*i/segments,y=bridgeDeckHeight(profile,x)+.07;
      if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    for(let i=segments;i>=0;i--){
      const x=-span/2+span*i/segments,y=bridgeDeckHeight(profile,x)+.68;
      shape.lineTo(x,y);
    }
    shape.closePath();
    const wall=add(new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false}),stone);
    wall.position.z=side*(deckWidth/2-.12)-(side<0?.24:0);
    const coping=new THREE.Shape();
    for(let i=0;i<=segments;i++){
      const x=-span/2+span*i/segments,y=bridgeDeckHeight(profile,x)+.65;
      if(!i)coping.moveTo(x,y);else coping.lineTo(x,y);
    }
    for(let i=segments;i>=0;i--){
      const x=-span/2+span*i/segments,y=bridgeDeckHeight(profile,x)+.79;
      coping.lineTo(x,y);
    }
    coping.closePath();
    const rail=add(new THREE.ExtrudeGeometry(coping,{depth:.40,bevelEnabled:false}),topstone);
    rail.position.z=side*(deckWidth/2-.12)-(side<0?.40:0);
  }
  const angle=-Math.atan2(profile.dirZ,profile.dirX);
  root.position.set(profile.x,0,profile.z);root.rotation.y=angle;
  root.userData={...profile,type:'stone-bridge'};
  return {group:root,dispose(){root.parent?.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

export function loadBridgeStoneTexture(THREE){
  const texture=new THREE.TextureLoader().load(gouacheAssetUrl('house','landmarkStone'));
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
  texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(.35,.35);
  texture.anisotropy=4;
  return texture;
}
