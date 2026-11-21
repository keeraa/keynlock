// Palace landmark model; all shared geometry and LOD services are injected.
export function buildPalace(ctx) {
  const {T,root,m,hi,lo,mid,chimneys,attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch}=ctx;
    // The four corner towers extend to x=+/-21.4 m. Support their full
    // footprint with masonry, including an outer margin at both ends.
    const palaceFoundation=box(0,.35,-1,44,.7,24.3,'stone');
    palaceFoundation.userData.landmarkPalaceFoundation=true;
    const wing=(x,w)=>{
      box(x,6.1,-2.1,w,11,16,'plaster');
      box(x,1.2,-2.1,w+.4,2.0,16.4,'stone');
      box(x,11.65,-2.1,w+.3,.48,16.3,'ivory');
      // Eaves should overlap the cornice rather than reveal sky between them.
      const roof=hipRoof(x,11.86,-2.1,w+.1,16.1,3.8,'slate');
      roof.userData.landmarkPalaceRoof=true;
      if(chimneys)chimney(x,12.8,-4.1,3.7);
      const n=lo?3:hi?6:4;
      for(let i=0;i<n;i++){
        const xx=x+(i/(n-1)-.5)*(w-2.3);
        for(const yy of [3.2,7.5])arch(xx,yy,6.02,lo?1.0:1.28,lo?2.15:2.75,{glass:'glassLight',frame:'ivory'});
      }
    };
    wing(-12.7,13.1);wing(12.7,13.1);
    box(0,7.1,-2.1,13.8,13.2,16.2,'ivory');
    box(0,13.86,-2.1,14.3,.45,16.5,'stone');
    const centralRoof=hipRoof(0,14.06,-2.1,14.1,16.2,4.4,'slate');
    centralRoof.userData.landmarkPalaceRoof=true;
    // Colonnaded projecting central risalit.
    const palacePodium=box(0,2.15,7.25,11.9,3.1,4.0,'stone');
    palacePodium.userData.landmarkColumnSupport=true;
    box(0,10.88,8.3,12.7,.65,5.4,'ivory');
    for(const x of [-5.2,-3.1,-1.05,1.05,3.1,5.2])column(x,8.55,3.7,7.0,.35);
    // The sculpted triangle and its sun belong near the front lip of the
    // portico entablature (front z=11), not halfway across its flat roof.
    const pedimentFrontZ=10.78;
    const palacePediment=pediment(0,11.22,pedimentFrontZ,13,3.0,'ivory');
    palacePediment.userData.landmarkPalacePediment=true;
    if(hi){
      const sun=ball(0,12.0,pedimentFrontZ+.12,.45,'gold',16);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        beam([Math.cos(a)*.68,12+Math.sin(a)*.52,pedimentFrontZ+.17],[Math.cos(a)*1.06,12+Math.sin(a)*.8,pedimentFrontZ+.17],.065,'gold');
      }
      sun.scale.z=.6;
    }
    // Portico openings are fixed to the central facade (front at z=6.0).
    // The old z=8.4 positions placed them in the empty air between the wall
    // and the freestanding columns.
    facadeArch(6.0,0,3.72,6.12,2.6,4.5,{entrance:true,frame:'ivory'});
    for(const x of [-4.5,4.5])facadeArch(6.0,x,4.6,6.12,1.6,3.7,{glass:'glassLight',frame:'stone'});
    for(const x of [-3.3,0,3.3])arch(x,10.9,6.14,1.38,2.4,{glass:'glassLight',frame:'stone'});
    // Four corner pavilions anchor the silhouette; lower than church tower.
    for(const x of [-19.3,19.3])for(const z of [-9.3,5.6]){
      const towerBody=box(x,8.25,z,4.2,15.1,4.15,'cream');
      towerBody.userData.landmarkPalaceCornerTower=true;
      box(x,.91,z,4.5,.42,4.45,'stone');
      for(const yy of [4.0,9.1])if(!lo)arch(x,yy,z+2.13,1.25,2.65,{glass:'glassLight',frame:'ivory'});
      box(x,16.02,z,4.6,.5,4.7,'stone');
      // Spires begin above the highest adjacent hip-roof ridge (15.8 m).
      // Their bases previously cut through the painted roof faces.
      cone(x,18.88,z,3.35,5.3,'slate',4);
      if(!lo)ball(x,21.70,z,.26,'gold',10);
    }
    stairs(9.25,11.6,14,3.7/14);
    if(!lo){
      // Front ornamental balustrades and flower planters.
      for(const x of [-15.2,-13.9,-12.6,-11.3,11.3,12.6,13.9,15.2]){
        box(x,6.75,6.0,.21,1.05,.2,'ivory');
        ball(x,7.42,6.0,.17,'stone',8);
      }
      for(const x of [-8.2,8.2]){
        box(x,.95,10.5,1.5,1.25,1.5,'stone');
        if(hi)ball(x,1.75,10.5,.5,'grass');
      }
    }

}
