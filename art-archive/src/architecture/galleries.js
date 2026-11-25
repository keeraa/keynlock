import {entranceJunction} from './entrance-junction.js';
import {buildWingTerrace} from './manor.js';
import {buildGalleryShell} from './gallery-shell.js';
import {buildGalleryVault} from './gallery-vault.js';
import {buildGallerySigns} from './gallery-signs.js';
import {buildArchThreshold} from './arch-threshold.js';
export function buildGalleries(context){
 const {THREE, layout, root, roofs, len}=context;
 // Independent wings; dimensions and labels come from config/scene.json.
 for(const h of layout.halls){
  const g=new THREE.Group();g.rotation.y=h.angle;root.add(g);
  const roof=new THREE.Group();roof.rotation.y=h.angle;roofs.add(roof);
  const start=h.start,end=start+len;
  g.userData.galleryId=roof.userData.galleryId=h.id;
  const junctions=[-1,1].map(side=>entranceJunction(layout,h,side));
  const parts={h,g,roof,start,end,junctions};
  buildGalleryShell(context,parts);
  buildArchThreshold(context,parts);
  buildGalleryVault(context,parts);
  // These surfaces belong to the exterior and the rotunda-facing drum.
  const exterior=new THREE.Group();exterior.rotation.y=h.angle;root.add(exterior);
  buildGallerySigns(context,{...parts,g:exterior});
  buildWingTerrace(context,{...parts,g:exterior});
 }

}
