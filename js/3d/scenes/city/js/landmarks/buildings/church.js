// Church landmark model; all shared geometry and LOD services are injected.
export function buildChurch(ctx) {
  const {T,root,m,hi,lo,mid,chimneys,attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch}=ctx;
    box(0,.27,0,14.7,.55,23.5,'stone');
    box(0,5.8,-1.1,9.8,10.8,18,'ivory');
    box(0,1.15,-1.1,10.1,1.55,18.3,'stone');
    wedge(0,11.15,-1.1,10.0,18,4.1,'slate');
    if(chimneys)chimney(-3.0,11.45,-4.5,3.35);
    for(const s of [-1,1]){
      box(s*6.35,3.7,-1.2,3.1,6.9,15.4,'cream');
      box(s*6.35,.7,-1.2,3.4,.9,15.5,'stone');
      // Rooflets over the low side aisles sit below the main clerestory.
      wedge(s*6.35,7.2,-1.2,3.1,15.4,1.85,'slate');
      const bayCount=lo?3:hi?5:4,spacing=11.7/(bayCount-1);
      for(let i=0;i<bayCount;i++){
        const z=-6.5+i*spacing;
        const window=arch(s*7.92,2.6,z,1.12,3.2,{glass:'glassLight',side:s});
        window.userData.landmarkChurchAisleWindow=true;
      }
      if(!lo)for(let i=0;i<bayCount-1;i++){
        // The buttress bears against the aisle wall in the middle of a pier,
        // between two windows, rather than hovering beside one sash.
        const z=-6.5+(i+.5)*spacing;
        const pier=box(s*8.13,3.05,z,.65,5.7,.72,'cream');
        pier.userData.landmarkChurchButtress=true;
        const foot=box(s*8.2,.64,z,.88,1.12,1.02,'cream');
        foot.userData.landmarkChurchButtressFoot=true;
        box(s*8.13,6.0,z,.78,.2,.84,'ivory');
      }
    }
    if(!lo)sideWindows(4.96,-7.7,4.3,4,8.7,1.1,2.15,{glass:'glassLight',frame:'cream'});
    // Hexagonal, lower polygonal choir: apse terminates the central nave.
    const apse=cyl(0,5.05,-10.4,3.7,3.7,8.7,'ivory',hi?12:lo?6:8);apse.scale.z=.76;
    const apseRoof=cone(0,11.1,-10.4,4.15,3.8,'slate',hi?12:lo?6:8);apseRoof.scale.z=.8;
    for(const i of [-1,0,1])arch(i*2,4.5,-13.15,1.08,3.3,{glass:'glassLight'});
    // The tower protrudes from the western (front) facade, with a valid entry.
    box(0,9.2,9.25,5.1,17.7,5.2,'ivory');
    box(0,.6,9.25,5.55,1.1,5.7,'stoneDark');
    // Cornices occupy the stone piers BETWEEN the door, window and belfry.
    // The former 4.4/10.5 m belts visibly sliced through both arches.
    for(const y of [6.1,13.05,17.1]){
      const band=box(0,y,9.25,5.5,.42,5.65,'ivory');
      band.userData.landmarkChurchTowerBand=true;
    }
    const entry=arch(0,.95,11.98,2.35,4.35,{entrance:true,frame:'ivory'});
    entry.userData.landmarkChurchTowerOpening=true;
    const middleWindow=arch(0,9.0,11.89,1.9,3.0,{glass:'glassLight',frame:'ivory'});
    middleWindow.userData.landmarkChurchTowerOpening=true;
    // Belfry opening: dark recessed arch on each visible face.
    box(0,20.15,9.25,4.35,5.4,4.4,'ivory');
    arch(0,18.65,11.53,1.45,3.5,{glass:'shadow',mullions:false});
    if(!lo){
      arch(-2.19,18.65,9.25,1.4,3.4,{glass:'shadow',side:-1,mullions:false});
      arch(2.19,18.65,9.25,1.4,3.4,{glass:'shadow',side:1,mullions:false});
      if(hi){cyl(0,19.55,11.63,.42,.42,.58,'gold',12);}
    }
    box(0,23.02,9.25,5.7,.66,5.6,'ivory');
    cone(0,27.4,9.25,3.55,8.4,'slate',4);
    cyl(0,31.72,9.25,.12,.12,1.4,'gold',8);
    beam([-1.05,32.05,9.25],[1.05,32.05,9.25],.12,'gold');
    if(hi)for(const x of [-2.5,2.5]){
      box(x,11.65,11.35,.3,1.3,.3,'ivory');
      ball(x,12.45,11.35,.23,'gold');
    }
    stairs(12.0,5.5,4,.14);

}
