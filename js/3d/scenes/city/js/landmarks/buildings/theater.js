// Theater landmark model; all shared geometry and LOD services are injected.
export function buildTheater(ctx) {
  const {T,root,m,hi,lo,mid,chimneys,attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch}=ctx;
    // One full-footprint plinth under the auditorium, portico AND deep stage.
    const foundation=box(0,.26,-2,21.2,.52,24.7,'stone');
    foundation.userData.landmarkTheaterFoundation=true;
    box(0,5.25,-1.1,19.2,9.6,14,'brick');
    // Rear stage begins at the back of the auditorium. Its taller walls no
    // longer project through the lower red-tile auditorium roof.
    box(0,5.2,-11.2,15.2,9.8,6.2,'plaster'); // stage fly-house
    box(0,11.2,-11.2,15.3,2.4,6.3,'brick');
    wedge(0,10.0,-1.1,19.1,14.1,3.9,'roof',.45,'brick');
    // The stage roof now ends behind the auditorium eave; pitched meshes
    // previously intersected and made an uneven notch at the junction.
    wedge(0,12.6,-11.85,15.2,5.95,2.6,'roofDeep',.45,'brick');
    if(chimneys)chimney(4.15,12.7,-11.1,3.45);
    const entranceWallZ=6.55;
    box(0,5.2,5.2,16.3,8.9,2.7,'ivory');
    box(0,9.8,8.6,18,.72,3.6,'stone');
    // A solid stone podium replaces the previously suspended thin shelf.
    // Its bottom joins the plaza foundation and its top carries every column.
    const theaterPodium=box(0,.88,7.85,21.2,.72,4.6,'stone');
    theaterPodium.userData.landmarkColumnSupport=true;
    const count=lo?4:hi?6:5;
    for(let i=0;i<count;i++){
      const x=(-.5+i/(count-1))*13.3;
      column(x,9.05,1.24,8.25,.37);
    }
    pediment(0,10.15,10.4,18,3.1,'ivory');
    if(hi){
      box(0,11.03,10.77,4.9,.33,.22,'gold');
      // Decorative lyre motif in the tympanum.
      beam([-1.2,10.72,10.8],[0,12.06,10.8],.1,'gold');
      beam([1.2,10.72,10.8],[0,12.06,10.8],.1,'gold');
      ball(0,11.3,10.85,.25,'gold');
    }
    // Recess the entrance wall and put the half-sized doors in the bays
    // between columns instead of directly behind their shafts.
    for(const x of [-5.32,0,5.32])facadeArch(entranceWallZ,x,1.24,entranceWallZ+.07,1.125,2.125,{entrance:true,frame:'stone'});
    const sideN=lo?2:4;
    for(const sign of [-1,1])for(let i=0;i<sideN;i++)arch(sign*9.7,5.1,-5.6+i*(10/(sideN-1)),1.25,2.4,{glass:'glassLight',side:sign});
    if(!lo){
      for(const x of [-7.7,7.7]){
        // Pilasters run from the podium all the way into the entablature.
        const pilaster=box(x,5.34,8.31,.5,8.2,.36,'stone');
        pilaster.userData.landmarkTheaterPilaster=true;
        if(hi){ball(x,9.37,8.45,.38,'gold');}
      }
    }
    stairs(10.15,17,6,.207);

}
