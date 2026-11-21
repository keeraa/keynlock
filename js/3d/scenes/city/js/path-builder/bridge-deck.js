import {bridgeDeckHeight} from './landscape-model.js';
import {PAVING_MAP,PAVING_STONE_SIZE} from './paving-art.js';
import {bridgeRoadWidth,bridgeWorld} from './bridge-frame.js';

// The bridge's visible paving is a thin curved sheet. Seal it from underneath
// with a real stone slab: no river, road triangle or sky may show between the
// staggered cobbles when the terrain and masonry have different tessellation.
export function createBridgeDeckSlab(THREE,profile){
  const half=profile.span/2;
  const sections=Math.max(32,Math.ceil(profile.span/1.6));
  const shape=new THREE.Shape();
  for(let i=0;i<=sections;i++){
    const x=-half+profile.span*i/sections;
    const y=bridgeDeckHeight(profile,x)-.025;
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  for(let i=sections;i>=0;i--){
    const x=-half+profile.span*i/sections;
    shape.lineTo(x,bridgeDeckHeight(profile,x)-.24);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth:profile.deckWidth-.12,
    steps:1,bevelEnabled:false,curveSegments:6});
}

// A separate road ribbon follows the REAL arched stone deck instead of the
// coarse ground mesh. Its cobblestones share world-space UVs with the city
// streets on either bank, so the route visually continues onto the bridge.
export function createBridgeCobbleDeck(THREE,profile){
  const sections=Math.max(28,Math.ceil(profile.span/1.5));
  const half=profile.span/2;
  const width=bridgeRoadWidth(profile);
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=sections;i++){
    const along=-half+profile.span*i/sections;
    const y=bridgeDeckHeight(profile,along)+.075;
    for(const across of [-width/2,width/2]){
      positions.push(along,y,across);
      const [worldX,worldZ]=bridgeWorld(profile,along,across);
      uvs.push((worldX+PAVING_MAP.width/2)/PAVING_STONE_SIZE.tileMetres,
        (PAVING_MAP.depth/2-worldZ)/PAVING_STONE_SIZE.tileMetres);
    }
  }
  for(let i=0;i<sections;i++){
    const a=2*i;indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
