// Townhall landmark model; all shared geometry and LOD services are injected.
export function buildTownhall(ctx) {
  const {T,root,m,hi,lo,mid,chimneys,attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch}=ctx;
    box(0,.28,-.6,19.6,.56,14.8,'stone');
    box(0,6.3,-1,18.4,11.8,13,'cream');
    // Low plinth stops below the openings; the old 2.15 m band hid
    // the lower portions of every ground-floor arch and the main door.
    box(0,.51,-1,18.9,.88,13.4,'stone');
    wedge(0,12.15,-1,18.8,13.6,4.0,'slate');
    if(chimneys)chimney(-5.65,11.95,-4.2,4.05);
    // Public arcaded ground floor, dark inset archways.
    const count=lo?3:5;
    for(let i=0;i<count;i++){
      const x=-7.0+i*(14/(count-1));
      arch(x,1.1,5.65,1.8,3.3,{glass:i===(count-1)/2?'wood':'shadow',frame:'ivory',entrance:i===(count-1)/2});
      if(!lo)arch(x,7.0,5.69,1.35,2.3,{glass:'glassLight',frame:'ivory'});
    }
    for(const sign of [-1,1])for(let i=0;i<(lo?2:3);i++)arch(sign*9.26,6,-4.5+i*3.65,1.2,2.5,{glass:'glassLight',side:sign});
    box(0,4.67,6.3,6.1,.32,2.1,'stone'); // balcony
    if(!lo){
      for(let i=0;i<9;i++)box(-2.6+i*.65,5.30,7.2,.13,1.05,.13,'iron');
      box(0,5.82,7.2,6,.18,.2,'iron');
    }
    // Tall municipal tower, clock set into the front wall above the roofline.
    const towerLift=3.5;
    box(0,16.1+towerLift,-1.1,5.7,11.4,5.6,'ivory');
    for(const y of [12.0,17.9,21.9])box(0,y+towerLift,-1.1,6.05,.45,6.0,'stone');
    clock(0,18.9+towerLift,1.64,1.45);
    arch(0,14.0+towerLift,1.84,1.6,2.5,{glass:'shadow',frame:'stone'});
    if(!lo){
      for(const sign of [-1,1])arch(sign*2.9,14+towerLift,-1.15,1.12,2.7,{glass:'shadow',side:sign});
      for(const x of [-2.7,2.7])cyl(x,22.7+towerLift,1.2,.25,.25,1.2,'gold',8);
    }
    box(0,22.43+towerLift,-1.1,6.3,.65,6.2,'stone');
    cone(0,25.85+towerLift,-1.1,4.2,6.2,'copper',4);
    cyl(0,29.3+towerLift,-1.1,.12,.12,1.4,'gold',8);
    ball(0,30.15+towerLift,-1.1,.4,'gold',10);
    stairs(6.8,8.6,4,.26);

}
