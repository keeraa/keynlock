export function createOpenings({THREE,mats,box,cylinder,simplified,minimal}) {
  // One painted glass sheet serves every window. A stable per-opening crop,
  // quarter-turn and reflection make its brush marks differ without allocating
  // hundreds of GPU materials or repeating the picture across the arch.
  function setGlassUV(geometry,width,bottom,top,owner,{boxUV=false}={}) {
    const positions=geometry.getAttribute('position');
    const uv=geometry.getAttribute('uv');
    const hash=Math.abs(Math.sin(owner.position.x*127.1+owner.position.y*311.7+
      owner.position.z*74.7+width*13.21)*43758.5453);
    const seed=(Math.floor((hash%1)*4294967295)>>>0);
    const turn=seed%4,reflection=(seed>>>6)&1;
    const span=.78+((seed>>>10)%16)/100;
    const offsetU=(1-span)*((seed>>>15)%101)/100;
    const offsetV=(1-span)*((seed>>>22)%101)/100;
    for(let i=0;i<positions.count;i++){
      const u=boxUV?uv.getX(i):positions.getX(i)/width+.5;
      const v=boxUV?uv.getY(i):(positions.getY(i)-bottom)/(top-bottom);
      const flipped=reflection?1-u:u;
      const rotated=turn===0?[flipped,v]:turn===1?[1-v,flipped]:
        turn===2?[1-flipped,1-v]:[v,1-flipped];
      uv.setXY(i,offsetU+rotated[0]*span,offsetV+rotated[1]*span);
    }
    uv.needsUpdate=true;
    geometry.userData.glassVariation={turn,reflection,span,offsetU,offsetV};
  }

  function glassBox(parent,size,pos){
    const pane=box(parent,size,pos,mats.glass,{cast:false});
    setGlassUV(pane.geometry,size[0],-size[1]/2,size[1]/2,parent,{boxUV:true});
    pane.userData.glassPane=true;
    return pane;
  }

  // All window layers use the same spring and elliptical crown; this prevents
  // the surround, glass and mullions from drifting apart as width changes.
  function windowPanel(parent,{width,bottom,spring,rise,z,material,arched,segments=12}) {
    if(!arched){
      return material===mats.glass?
        glassBox(parent,[width,spring-bottom,.025],[0,(spring+bottom)/2,z]):
        box(parent,[width,spring-bottom,.025],[0,(spring+bottom)/2,z],material,{cast:false});
    }
    const outline=new THREE.Shape();
    outline.moveTo(-width/2,bottom);
    outline.lineTo(width/2,bottom);
    outline.lineTo(width/2,spring);
    for(let i=1;i<=segments;i++){
      const a=Math.PI*i/segments;
      outline.lineTo(Math.cos(a)*width/2,spring+Math.sin(a)*rise);
    }
    outline.closePath();
    const geometry=new THREE.ShapeGeometry(outline);
    if(material===mats.glass)setGlassUV(geometry,width,bottom,spring+rise,parent);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.z=z;
    if(material===mats.glass)mesh.userData.glassPane=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  // The old 32×5 TubeGeometry used 320 triangles for the little arch rim
  // alone. A shallow, V-shaped painted stone profile needs four triangles per
  // path segment and still catches light at the beveled front edge.
  function archedWindowRim(width,bottom,spring,rise,segments=14,
    {halfThickness=.034,backZ=.082,ridgeZ=.111}={}) {
    const radius=width/2;
    const path=[[-radius,bottom],[-radius,spring]];
    for(let i=1;i<=segments;i++){
      const angle=Math.PI-i*Math.PI/segments;
      path.push([Math.cos(angle)*radius,spring+Math.sin(angle)*rise]);
    }
    path.push([radius,bottom]);
    const distances=[0];
    for(let i=1;i<path.length;i++){
      const dx=path[i][0]-path[i-1][0];
      const dy=path[i][1]-path[i-1][1];
      distances.push(distances[i-1]+Math.hypot(dx,dy));
    }
    const length=distances.at(-1);
    const positions=[],uv=[],indices=[];
    for(let i=0;i<path.length;i++){
      const prev=path[Math.max(i-1,0)], next=path[Math.min(i+1,path.length-1)];
      const dx=next[0]-prev[0],dy=next[1]-prev[1];
      const scale=1/Math.hypot(dx,dy);
      const nx=-dy*scale,ny=dx*scale;
      const [x,y]=path[i],u=distances[i]/length;
      positions.push(x-nx*halfThickness,y-ny*halfThickness,backZ,
        x,y,ridgeZ, x+nx*halfThickness,y+ny*halfThickness,backZ);
      uv.push(u,0,u,.5,u,1);
      if(i===path.length-1)continue;
      const a=i*3,b=a+3;
      // Both bevel facets face outward, toward the viewer (+Z).
      indices.push(a,b,a+1,a+1,b,b+1, a+1,b+1,a+2,a+2,b+1,b+2);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addBalconyInnerFrame(door,width,spring,rise){
    // The entire wooden jamb and curved head are one bevelled ribbon.
    // This also prevents Catmull-Rom overshoot at the spring points from
    // producing the missing corners visible on the balcony French doors.
    const frame=new THREE.Mesh(archedWindowRim(width-.036,.055,spring,rise,
      simplified?14:24,{halfThickness:.028,backZ:.19,ridgeZ:.23}),mats.wood);
    frame.castShadow=false;frame.receiveShadow=true;
    frame.userData.balconyInnerFrame=true;
    door.add(frame);
  }

  function rectangularWindowSurround(width,height){
    // Single U-shaped stone frame: the head spans the FULL outside width of
    // the side jambs. Separate box parts used to expose two vertical seams at
    // the top corners and could render as broken hairlines.
    const outer=width/2+.085,inner=width/2+.006;
    const top=height/2+.10,innerTop=height/2-.003;
    const bottom=-height/2-.045;
    const outline=new THREE.Shape();
    outline.moveTo(-outer,bottom);
    outline.lineTo(-outer,top);
    outline.lineTo(outer,top);
    outline.lineTo(outer,bottom);
    outline.lineTo(inner,bottom);
    outline.lineTo(inner,innerTop);
    outline.lineTo(-inner,innerTop);
    outline.lineTo(-inner,bottom);
    outline.closePath();
    const geometry=new THREE.ExtrudeGeometry(outline,{depth:.09,bevelEnabled:false,steps:1});
    const frame=new THREE.Mesh(geometry,mats.sill);
    frame.position.z=.02;
    frame.castShadow=false;
    frame.receiveShadow=true;
    frame.userData.rectangularWindowFrame=true;
    return frame;
  }

  function addWindowShutters(parent,width,style,h,spring,rise) {
    const leafWidth=width*.475;
    for(const side of [-1,1]){
      // A real hinge pivot at the jamb folds the closed leaf to the outside.
      // Arched leaves meet at the crown when closed and retain that profile
      // when folded back; rectangular leaves remain rectangular.
      const hinge=new THREE.Group();
      hinge.position.set(side*(width/2+.055),0,.11);
      hinge.rotation.y=side*2.35;
      hinge.userData.shutterHinge=side;
      parent.add(hinge);
      const freeX=-side*leafWidth;
      const bottom=-h/2-.035;
      const localSpring=spring-.07;
      const outline=new THREE.Shape();
      outline.moveTo(0,bottom);
      outline.lineTo(freeX,bottom);
      if(style==='arched'){
        const crown=rise+.02;
        outline.lineTo(freeX,localSpring+crown);
        const steps=simplified?6:9;
        for(let i=1;i<=steps;i++){
          const t=1-i/steps;
          outline.lineTo(freeX*t,localSpring+crown*Math.sin(t*Math.PI/2));
        }
      }else{
        outline.lineTo(freeX,localSpring+.07);
        outline.lineTo(0,localSpring+.07);
      }
      outline.closePath();
      const geometry=new THREE.ExtrudeGeometry(outline,{
        depth:simplified?.045:.075,bevelEnabled:false,steps:1,
        curveSegments:simplified?6:9,
      });
      // ExtrudeGeometry's default coordinates are signed model-space values;
      // they mirrored/repeated the painting across each leaf. One full vertical
      // sheet per leaf makes the gouache slats horizontal, including on arches.
      const positions=geometry.getAttribute('position');
      const uv=geometry.getAttribute('uv');
      const top=style==='arched'?localSpring+rise+.02:localSpring+.07;
      for(let i=0;i<positions.count;i++){
        uv.setXY(i,
          Math.min(1,Math.max(0,Math.abs(positions.getX(i))/leafWidth)),
          Math.min(1,Math.max(0,(positions.getY(i)-bottom)/(top-bottom))));
      }
      uv.needsUpdate=true;
      const shutter=new THREE.Mesh(geometry,mats.shutter);
      shutter.position.y=.07;
      shutter.castShadow=!simplified;
      shutter.receiveShadow=true;
      shutter.userData.shutterPanel=true;
      shutter.userData.shutterStyle=style;
      hinge.add(shutter);
      if(!simplified){
        // Four tiny full-round pins and raised straps cost 176 triangles per
        // window (and eight shadow casters). At this scale a four-sided metal
        // pin and a flat painted fastening plate preserve the hinge silhouette.
        for(const hingeY of [-h*.27,h*.27]){
          const pin=cylinder(parent,.024,.105,[hinge.position.x,hingeY,.15],mats.brass,4);
          pin.castShadow=false;
          pin.userData.shutterHingePin=true;
          const strap=new THREE.Mesh(new THREE.PlaneGeometry(.08,.028),mats.woodDark);
          strap.position.set(hinge.position.x-side*.035,hingeY,.153);
          strap.receiveShadow=true;
          strap.userData.shutterHingeStrap=true;
          parent.add(strap);
        }
      }
    }
  }

  function addWindow(parent, width, style, shutters) {
    const h=1.33;
    const arched=style==='arched';
    const spring=h/2-.025, rise=width*.35;
    parent.userData.windowStyle=style;
    parent.userData.windowWidth=width;
    if(simplified) {
      // A lighter profile for medium/low LOD without changing the outline.
      windowPanel(parent,{width:width+.16,bottom:-h/2-.065,spring,rise:rise+.06,z:.025,
        material:mats.stoneBand,arched,segments:8});
      windowPanel(parent,{width:width-.065,bottom:-h/2+.045,spring:spring-.02,
        rise:Math.max(.08,rise-.035),z:.07,material:mats.glass,arched,segments:8});
      if(minimal){
        const grille=new THREE.Mesh(new THREE.PlaneGeometry(.043,
          arched?h+rise-.10:h-.08),mats.wood);
        grille.position.set(0,arched?rise/2-.015:0,.085);
        grille.receiveShadow=true;
        parent.add(grille);
      }else box(parent,[.043,arched?h+rise-.10:h-.08,.028],
        [0,arched?rise/2-.015:0,.085],mats.wood,{cast:false});
      if(!minimal){
        const crossbar=box(parent,[width+.01,.044,.028],[0,arched?.06:-.12,.085],mats.wood,{cast:false});
        crossbar.userData.windowMullion='horizontal';
        const sill=box(parent,[width+.15,.095,.15],[0,-h/2-.015,.075],mats.sill,{cast:false});
        sill.userData.windowSill=true;
        if(shutters)addWindowShutters(parent,width,style,h,spring,rise);
      }
      return;
    }
    if(arched) {
      windowPanel(parent,{width:width+.16,bottom:-h/2-.065,spring,rise:rise+.06,
        z:.025,material:mats.stoneBand,arched:true});
      windowPanel(parent,{width:width+.035,bottom:-h/2-.035,spring,rise:rise+.015,
        z:.046,material:mats.woodDark,arched:true});
      windowPanel(parent,{width:width-.065,bottom:-h/2+.045,spring:spring-.02,
        rise:rise-.035,z:.068,material:mats.glass,arched:true});

      const rimGeometry=archedWindowRim(width+.16,-h/2-.045,
        spring,rise+.06,13,{halfThickness:.06});
      // One connected, gently painted bevel from jamb to jamb. An additional
      // wooden arch doubled the profile and created tiny joints at the crown.
      const moulding=new THREE.Mesh(rimGeometry,mats.sill);
      moulding.userData.windowFrame=true;
      parent.add(moulding);
      // Inset the wooden cross behind the outer stone bevel, nearly flush with
      // the glass so it no longer looks like loose sticks attached to the wall.
      const vertical=box(parent,[.045,h+rise,.027],[0,rise/2-.015,.082],mats.wood,{cast:false});
      vertical.userData.windowMullion='vertical';
      const horizontal=box(parent,[width+.01,.043,.027],[0,.06,.082],mats.wood,{cast:false});
      horizontal.userData.windowMullion='horizontal';
    } else {
      const surface=box(parent,[width+.16,h+.13,.055],[0,0,.025],mats.stoneBand);
      surface.castShadow=false;
      box(parent,[width+.035,h+.01,.045],[0,0,.054],mats.woodDark,{cast:false});
      glassBox(parent,[width-.065,h-.08,.03],[0,0,.082]);
      box(parent,[.045,h-.065,.025],[0,0,.099],mats.wood,{cast:false});
      // Lower the crossbar slightly below centre on all square windows.
      const crossbar=box(parent,[width+.01,.043,.025],[0,-.12,.099],mats.wood,{cast:false});
      crossbar.userData.windowMullion='horizontal';
      parent.add(rectangularWindowSurround(width,h));
    }
    const sill=box(parent,[width+.15,.10,.17],[0,-h/2-.015,.085],mats.sill);
    sill.userData.windowSill=true;
    if(shutters)addWindowShutters(parent,width,style,h,spring,rise);
  }

  // The carved front entrance is a single low-poly painted surface. Its
  // symmetric carved panels, leaf seam and joinery live in the gouache image;
  // only the two brass handles need to project from the door itself.
  function addPaintedEntrance(parent,c,bottomY,z) {
    const door=new THREE.Group();
    door.position.set(0,bottomY,z);
    door.userData.doorStyle=c.doorStyle;
    door.userData.balconyDoor=false;
    parent.add(door);
    const w=1.35, arched=c.doorStyle==='arched';
    const h=arched?1.84:2.1;
    const rise=arched?.33:0;
    const outline=(width,spring,crown)=>{
      const shape=new THREE.Shape();
      shape.moveTo(-width/2,0);
      shape.lineTo(width/2,0);
      shape.lineTo(width/2,spring);
      if(crown){
        const count=minimal?6:simplified?10:18;
        for(let i=1;i<=count;i++){
          const angle=Math.PI*i/count;
          shape.lineTo(Math.cos(angle)*width/2,spring+Math.sin(angle)*crown);
        }
      } else shape.lineTo(-width/2,spring);
      shape.closePath();
      return shape;
    };
    if(arched){
      const outerW=w+.28,outerRise=rise+.075;
      const backing=new THREE.Mesh(new THREE.ShapeGeometry(outline(outerW,h,outerRise)),mats.stoneLight);
      backing.position.z=.06;
      backing.receiveShadow=true;
      door.add(backing);
      if(!minimal){
        const radius=outerW/2;
        const arch=[new THREE.Vector3(-radius,.06,.165),new THREE.Vector3(-radius,h,.165)];
        const count=simplified?14:28;
        for(let i=1;i<=count;i++){
          const a=Math.PI-i*Math.PI/count;
          arch.push(new THREE.Vector3(Math.cos(a)*radius,h+Math.sin(a)*outerRise,.165));
        }
        arch.push(new THREE.Vector3(radius,.06,.165));
        const frame=new THREE.Mesh(new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(arch,false,'centripetal'),simplified?20:36,.053,5,false),mats.highlight);
        frame.userData.continuousDoorFrame=true;
        door.add(frame);
      }
    }else{
      const backing=minimal
        ? new THREE.Mesh(new THREE.PlaneGeometry(w+.32,h+.19),mats.stoneLight)
        : box(door,[w+.32,h+.19,.085],[0,h/2,.06],mats.stoneLight,{cast:false});
      if(minimal){backing.position.set(0,h/2,.06);door.add(backing);}
      backing.userData.doorSurround=true;
      if(!minimal){
        for(const side of [-1,1]){
          const jamb=box(door,[.09,h,.13],[side*(w/2+.045),h/2,.16],mats.highlight,{cast:false});
          jamb.userData.doorSurround=true;
        }
        const lintel=box(door,[w+.48,.19,.25],[0,h+.095,.12],mats.highlight,{cast:false});
        lintel.userData.doorSurround=true;
      }
    }
    const geometry=new THREE.ShapeGeometry(outline(w,h,rise));
    const position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    for(let i=0;i<position.count;i++){
      uv.setXY(i,
        Math.min(1,Math.max(0,position.getX(i)/w+.5)),
        Math.min(1,Math.max(0,position.getY(i)/(h+rise))));
    }
    uv.needsUpdate=true;
    const painting=new THREE.Mesh(geometry,mats.door);
    painting.position.z=.138;
    painting.castShadow=false;
    painting.receiveShadow=true;
    painting.userData.paintedDoorPanel=true;
    door.add(painting);
    for(const side of [-1,1]){
      const handle=cylinder(door,.045,.085,[side*.13,h*.53,.180],mats.brass,minimal?4:simplified?7:10);
      handle.rotation.x=Math.PI/2;
      handle.userData.doorHandle=true;
    }
    const threshold=minimal
      ? new THREE.Mesh(new THREE.PlaneGeometry(w+.42,.13),mats.stone)
      : box(door,[w+.42,.13,.35],[0,-.02,.1],mats.stone);
    if(minimal){threshold.position.set(0,-.02,.1);door.add(threshold);}
    threshold.userData.doorThreshold=true;
    return door;
  }

  function addDoor(parent, c, bottomY, z, asBalcony=false) {
    if(!asBalcony)return addPaintedEntrance(parent,c,bottomY,z);
    const door=new THREE.Group();door.position.set(0,bottomY,z);parent.add(door);
    const w=asBalcony?1.10:1.35;
    const arched=c.doorStyle==='arched';
    door.userData.doorStyle=c.doorStyle;
    door.userData.balconyDoor=asBalcony;
    const h=arched?(asBalcony?1.74:1.84):(asBalcony?1.92:2.1);
    const archRise=asBalcony?.28:.33;
    if(simplified) {
      const panel=(w,spring,rise,zOffset,material)=>{
        if(!arched){
          if(material===mats.glass)glassBox(door,[w,spring,.06],[0,spring/2,zOffset]);
          else box(door,[w,spring,.06],[0,spring/2,zOffset],material);
          return;
        }
        const shape=new THREE.Shape();
        shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,spring);
        for(let i=1;i<=10;i++){
          const a=Math.PI*i/10;
          shape.lineTo(Math.cos(a)*w/2,spring+Math.sin(a)*rise);
        }
        shape.closePath();
        const geometry=new THREE.ShapeGeometry(shape);
        if(material===mats.glass)setGlassUV(geometry,w,0,spring+rise,door);
        const mesh=new THREE.Mesh(geometry,material);
        mesh.position.z=zOffset;mesh.castShadow=true;door.add(mesh);
        if(material===mats.glass)mesh.userData.glassPane=true;
      };
      panel(w+(asBalcony?.18:.27),h,archRise+(asBalcony?.05:.08),.07,
        asBalcony?mats.stoneBand:mats.stoneLight);
      panel(w,h,archRise,asBalcony&&!arched ? .125 : .15,asBalcony?mats.glass:mats.wood);
      if(!minimal){
        const trim=asBalcony?mats.wood:mats.highlight;
        const stileHeight=h+(arched?archRise:0)+.025;
        const stile=box(door,[.055,stileHeight,.08],[0,stileHeight/2,.19],trim);
        stile.userData.doorStile=true;
        for(const side of [-1,1])box(door,[.075,h,.10],[side*(w/2+.05),h/2,.18],trim);
        if(asBalcony)box(door,[w-.08,.055,.075],[0,h*.53,.21],mats.wood);
        if(asBalcony&&arched)addBalconyInnerFrame(door,w,h,archRise);
      }
      box(door,[w+.35,.13,.27],[0,-.025,.12],mats.stone);
      return;
    }
    if(arched) {
      // One continuous arched silhouette for each layer; the glazing and door
      // infill follow the actual outline instead of an unrelated semicircle.
      const panel=(width,springY,rise,depth,material)=>{
        const shape=new THREE.Shape();
        shape.moveTo(-width/2,0);
        shape.lineTo(width/2,0);
        shape.lineTo(width/2,springY);
        for(let i=1;i<=28;i++) {
          const angle=Math.PI*i/28;
          shape.lineTo(Math.cos(angle)*width/2,springY+Math.sin(angle)*rise);
        }
        shape.closePath();
        const geometry=new THREE.ShapeGeometry(shape);
        if(material===mats.glass)setGlassUV(geometry,width,0,springY+rise,door);
        const mesh=new THREE.Mesh(geometry,material);
        mesh.position.z=depth;
        if(material===mats.glass)mesh.userData.glassPane=true;
        mesh.castShadow=true;mesh.receiveShadow=true;
        door.add(mesh);
      };
      const outerWidth=w+(asBalcony?.18:.28);
      const outerRise=archRise+(asBalcony?.05:.075);
      panel(outerWidth,h,outerRise,.06,asBalcony?mats.stoneBand:mats.stoneLight);
      if(asBalcony)panel(w+.025,h,archRise+.012,.11,mats.woodDark);
      panel(asBalcony?w-.055:w,h,asBalcony?archRise-.025:archRise,
        asBalcony?.14:.135,asBalcony?mats.glass:mats.wood);
      // The jambs and the crown share one curve. The previous free-standing
      // semicircle ended outside the side rails and appeared detached.
      const archRadius=outerWidth/2;
      const trim=new THREE.Mesh(archedWindowRim(archRadius*2,.06,h,outerRise,28,
        {halfThickness:asBalcony?.037:.053,backZ:.147,ridgeZ:.179}),
        asBalcony?mats.stoneBand:mats.highlight);
      trim.userData.continuousDoorFrame=true;
      door.add(trim);
      if(asBalcony)addBalconyInnerFrame(door,w,h,archRise);
      // Vertical centre stile meets the arched head with no visible gap.
      const stileHeight=h+archRise-.012;
      const stile=box(door,[.055,stileHeight,.075],[0,stileHeight/2,.188],
        asBalcony?mats.wood:mats.woodDark);
      stile.userData.doorStile=true;
    } else {
      box(door,[w+.32,h+.19,.11],[0,h/2,.06],mats.stoneLight);
      if(asBalcony)glassBox(door,[w,h,.07],[0,h/2,.12]);
      else box(door,[w,h,.07],[0,h/2,.14],mats.wood);
      // The centre rail must disappear INTO the top lintel rather than stop
      // ten centimetres short, especially on rectangular balcony entrances.
      const stile=box(door,[.06,h+.035,.11],[0,(h+.035)/2,.22],asBalcony?mats.wood:mats.woodDark);
      stile.userData.doorStile=true;
    }
    for(const s of [-1,1]) {
      if(!arched)box(door,[.09,h,.15],[s*(w/2+.045),h/2,.18],
        asBalcony?mats.stoneBand:mats.highlight);
      if(!asBalcony) {
        box(door,[w*.32,h*.31,.02],[s*w*.25,h*.32,.19],mats.woodDark);
        box(door,[w*.32,h*.24,.02],[s*w*.25,h*.72,.19],mats.woodDark);
        cylinder(door,.045,.07,[s*.13,h*.53,.24],mats.brass,10).rotation.x=Math.PI/2;
      }
    }
    if(asBalcony){
      // One continuous French-door lattice. Old isolated white rods did not
      // meet the frame and looked like objects floating on the glass.
      const mullion=box(door,[w-.065,.055,.07],[0,h*.53,.217],mats.wood,{cast:false});
      mullion.userData.balconyMullion=true;
      for(const s of [-1,1]){
        const rail=box(door,[.05,h+.035,.07],[s*(w/2-.046),(h+.035)/2,.215],
          mats.wood,{cast:false});
        rail.userData.balconySideRail=true;
      }
      const kickplate=box(door,[w-.09,.22,.055],[0,.13,.211],mats.wood);
      kickplate.userData.balconyKickplate=true;
      cylinder(door,.027,.045,[.078,h*.49,.26],mats.brass,10).rotation.x=Math.PI/2;
    }
    box(door,[w+.42,.13,.35],[0,-.02,.1],mats.stone);
    if(!arched) {
      box(door,[w+.48,.19,.35],[0,h+.095,.12],mats.highlight);
    }
  }

  return {addWindow,addDoor};
}
