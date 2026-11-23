// Original painted surfaces from Keynlock Key Archive v122. One texture per URL.
export function createMaterials(THREE) {
 const loader=new THREE.TextureLoader(),textures=new Map(),materials=new Set();
 const texture=(file)=>{if(!textures.has(file)){const t=loader.load(new URL('../../assets/'+file,import.meta.url).href);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.anisotropy=4;textures.set(file,t);}return textures.get(file);};
 const make=(color,file)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.98,map:file?texture(file):null});materials.add(m);return m;};
 const mat={
  plaster:make(0xe6dfd0,'gouache-archive-limewash-v8.webp'),
  ivory:make(0xf5e8cf,'gouache-archive-ivory-v3.webp'),
  wood:make(0xb8a18a,'gouache-archive-walnut-v5.webp'),
  darkWood:make(0x79614b,'gouache-archive-walnut-v5.webp'),
  floor:make(0xc4b095,'gouache-floor-walnut-v1.webp'),
  stone:make(0xc8bca2,'gouache-archive-ivory-v3.webp'),
  rug:make(0xb8a1a0,'gouache-carpet-plain-v4.webp'),
  gold:make(0xb99451),roof:make(0x59635d),exterior:make(0xb5b29c),garden:make(0x40584b),
  glass:new THREE.MeshPhysicalMaterial({color:0xc2e1e8,roughness:.08,metalness:0,clearcoat:1,clearcoatRoughness:.05,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}),
  glow:new THREE.MeshBasicMaterial({color:0xffdda1}),
 };
 materials.add(mat.glass);materials.add(mat.glow);
 return {...mat,make,dispose(){for(const m of materials)m.dispose();for(const t of textures.values())t.dispose();},get textureCount(){return textures.size;}};
}
// Physical UV scale keeps the gouache brushwork consistent on narrow cornices.
export function metricBox(THREE,w,h,d,tile=3.5){
 const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv;
 const spans=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
 for(let face=0;face<6;face++)for(let j=0;j<4;j++){const i=face*4+j;uv.setXY(i,uv.getX(i)*spans[face][0]/tile,uv.getY(i)*spans[face][1]/tile);}
 return g;
}
