// Museum landmark model; all shared geometry and LOD services are injected.
export function buildMuseum(ctx) {
  const {T,root,m,hi,lo,mid,chimneys,attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch}=ctx;
    const museumFoundation=box(0,.28,-.3,24.9,.56,18.9,'stone');
    museumFoundation.userData.landmarkColumnSupport=true;
    box(0,5.15,-1.6,22.5,9.3,14.6,'plaster');
    box(0,9.95,-1.6,23,.56,15.2,'ivory');
    hipRoof(0,10.2,-1.6,23,15,2.5,'slate');
    if(chimneys)chimney(-7.5,10.45,-4.6,3.55);
    // Round rotunda emerges from the shallow hipped gallery roof.
    cyl(0,12.1,-2.4,4.1,4.1,3.55,'stone',hi?28:lo?12:18);
    for(let i=0;i<(lo?6:hi?12:8);i++){
      const a=i*2*Math.PI/(lo?6:hi?12:8);
      const x=Math.sin(a)*3.9,z=-2.4+Math.cos(a)*3.9;
      if(!lo)box(x,12.3,z,.21,2.55,.23,'ivory');
    }
    const dome=attach(new T.SphereGeometry(4.15,lo?12:hi?32:20,lo?6:hi?16:10,0,Math.PI*2,0,Math.PI/2),'copper',[0,13.8,-2.4]);
    dome.scale.y=.85;
    cyl(0,17.2,-2.4,.75,.9,.58,'gold',16);
    ball(0,17.7,-2.4,.35,'gold',12);
    box(0,4.85,6.5,17.2,8.7,3.1,'ivory');
    box(0,9.42,8.7,18.4,.62,4.5,'stone');
    const count=lo?4:6;
    for(let i=0;i<count;i++){
      const x=-7.2+i*14.4/(count-1);
      column(x,8.7,.56,8.56,.43);
    }
    pediment(0,9.71,10.95,18.2,3.1,'ivory');
    // All openings lie against the actual 8.05 m front wall.
    facadeArch(8.05,0,1.0,8.13,1.425,2.3,{entrance:true,frame:'stone'});
    for(const x of [-4.3,4.3])facadeArch(8.05,x,2.75,8.13,1.9,4.1,{glass:'glassLight',frame:'stone'});
    for(const sign of [-1,1])for(let i=0;i<(lo?2:4);i++)arch(sign*11.32,3.9,-6.8+i*3.6,1.18,2.85,{glass:'glassLight',side:sign});
    if(!lo){
      for(const x of [-9.4,9.4]){
        box(x,1.52,8.55,1.35,1.95,1.35,'stone');
        const sculpture=ball(x,2.97,8.55,.7,'ivory',hi?18:10);sculpture.scale.y=1.25;
        if(hi)cyl(x,3.44,8.55,.26,.25,.6,'ivory',8);
      }
    }
    stairs(9.15,18,4,.14);

}
