// Tower landmark model; all shared geometry and LOD services are injected.
export function buildTower(ctx) {
  const {T,root,m,hi,lo,mid,chimneys,attach,box,cyl,cone,ball,beam,wedge,hipRoof,arch,column,pediment,stairs,chimney,clock,sideWindows,facadeArch}=ctx;
    // Vertical city landmark: 59 metres to the finial, deliberately taller
    // than the town hall, palace and church. All LODs preserve its silhouette.
    box(0,.42,0,13.3,.84,13.3,'stone');
    for(const [y,w,h] of [[6.3,10.8,11.5],[18.7,9.4,13.4],[31.1,8.1,11.4]]){
      box(0,y,0,w,h,w,'cream');
      box(0,y+h/2+.13,0,w+.8,.42,w+.8,'stone');
    }
    box(0,1.45,0,11.8,1.9,11.8,'stone');
    facadeArch(5.44,0,.85,5.5,2.15,4.3,{entrance:true,frame:'ivory'});
    // Recessed vertical lancets and sharp, progressively narrower stages.
    for(const y of [8.0,20.8,32.5]){
      const half=y<15?5.45:y<28?4.75:4.12;
      arch(0,y,half+.02,1.2,3.25,{glass:'shadow',frame:'stone',mullions:hi});
      if(!lo){
        for(const x of [-2.4,2.4])arch(x,y,half+.02,.74,2.65,{glass:'glass',frame:'ivory',mullions:hi});
        for(const side of [-1,1])arch(side*half,y,0,1.05,3.0,{glass:'shadow',frame:'stone',side,mullions:hi});
      }
    }
    // Four heavy piers visibly anchor the slender shaft in the plinth.
    for(const x of [-5.1,5.1])for(const z of [-5.1,5.1]){
      box(x,6.5,z,.85,12.2,.85,'stone');
      if(hi){box(x,13.0,z,1.12,.6,1.12,'ivory');box(x,1.25,z,1.08,2.2,1.08,'stoneDark');}
    }
    // Clock belfry above the masonry stages. A front clock is legible at all
    // distances; other faces and open arches enrich the close-range model.
    box(0,40.1,0,8.65,6.7,8.65,'ivory');
    for(const y of [36.55,43.68])box(0,y,0,9.2,.56,9.2,'stone');
    // Supporting masonry joins the upper cornice to the lookout platform.
    box(0,44.19,0,9.0,.6,9.0,'ivory');
    clock(0,40.2,4.26,1.55);
    if(!lo){
      for(const side of [-1,1]){
        const face=new T.Group();face.rotation.y=side*Math.PI/2;face.position.x=side*4.30;root.add(face);
        const dial=new T.Mesh(new T.CylinderGeometry(1.48,1.48,.16,hi?36:20),m.pale);
        dial.rotation.x=Math.PI/2;dial.rotation.z=Math.PI/2;dial.position.y=40.2;face.add(dial);
      }
      for(const x of [-2.75,2.75])arch(x,36.95,4.39,.85,1.9,{glass:'shadow',frame:'stone'});
      for(let i=0;i<12;i++){
        const x=-4.1+i*.74;
        box(x,44.65,4.2,.16,1.2,.19,'iron');
      }
      box(0,45.2,4.2,9.0,.18,.2,'iron');
    }
    // Open lookout with four corner pinnacles and a very tall slate-and-
    // copper needle. Distinctive even in the low-poly silhouette.
    box(0,45.3,0,9.2,1.8,9.2,'stone');
    for(const x of [-3.8,3.8])for(const z of [-3.8,3.8]){
      cyl(x,47.15,z,.44,.48,2.4,'stone',8);
      cone(x,49.35,z,.86,2.1,'slate',8);
    }
    // The central roof stays inside the four corner pinnacles throughout its
    // height; previously its wide cone cut through their stone and slate.
    cone(0,51.83,0,3.35,11.4,'copper',8);
    cyl(0,58.20,0,.18,.18,1.4,'gold',8);
    ball(0,59.20,0,.36,'gold',hi?14:8);
    if(hi){
      for(const x of [-3.8,3.8])for(const z of [-3.8,3.8]){
        beam([x,14,z],[x,29,z],.12,'stoneDark',6);
      }
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        ball(Math.cos(a)*4.25,44.33,Math.sin(a)*4.25,.32,'ivory',8);
      }
    }
    stairs(6.2,5.1,4,.14);

}
