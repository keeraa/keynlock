export function createRoofParts({mats,box,beam,triangle,roofSurface,gableRoofProfile}) {
  function createRoof(root, c, top) {
    const eave = .42;
    const halfW = c.width/2, halfD=c.depth/2;
    if(c.roofType==='flat') {
      box(root,[c.width+.55,.27,c.depth+.55],[0,top+.14,0],mats.roofTop);
      box(root,[c.width+.62,.36,.16],[0,top+.31,halfD+.24],mats.stoneLight);
      box(root,[c.width+.62,.36,.16],[0,top+.31,-halfD-.24],mats.stoneLight);
      box(root,[.16,.36,c.depth+.55],[-halfW-.24,top+.31,0],mats.stoneLight);
      box(root,[.16,.36,c.depth+.55],[halfW+.24,top+.31,0],mats.stoneLight);
      return;
    }
    if (c.roofType==='gable') {
      const {span,ridgeY,edgeY} = gableRoofProfile(c,top,eave);
      const outerD=halfD+eave;
      for(const side of [-1,1]) {
        const corners=side===1?
          [[span,edgeY,outerD],[span,edgeY,-outerD],[0,ridgeY,-outerD],[0,ridgeY,outerD]]:
          [[-span,edgeY,-outerD],[-span,edgeY,outerD],[0,ridgeY,outerD],[0,ridgeY,-outerD]];
        roofSurface(root,corners,'side');
        const eaveBeam=box(root,[.18,.22,c.depth+eave*2],[side*span,edgeY-.03,0],mats.roofEdge);
        eaveBeam.userData.gableEaveBeam=side;
        // Sink the diagonal tip into the end-grain of the long eave beam.
        // The former 22 cm inset stopped visibly before the lower corner.
        for(const z of [-outerD,outerD]) {
          const fasciaZ=z-Math.sign(z)*.055;
          const fascia=beam(root,[0,ridgeY-.045,fasciaZ],
            [side*(span-.065),edgeY+.02,fasciaZ],.095,mats.roofEdge);
          fascia.userData.roofFascia=true;
          fascia.userData.roofFasciaSide=side;
        }
      }
      for(const z of [-halfD-.01,halfD+.01]) {
        triangle(root,z>0?[[-halfW,top,z],[halfW,top,z],[0,top+c.roofHeight,z]]:
          [[halfW,top,z],[-halfW,top,z],[0,top+c.roofHeight,z]],mats.plaster);
        // The dark outer fascia already traces this edge. Extra light-coloured
        // beams here pierced the roof planes as bright white diagonal stripes.
      }
      box(root,[.21,.22,c.depth+.9],[0,ridgeY+.025,0],mats.roofEdge);
      return;
    }
    const ridgeHalf = Math.max(.5,halfD - halfW*.75);
    const y = top+c.roofHeight;
    const bw=halfW+eave, bd=halfD+eave;
    const eaveY=top-c.roofHeight*eave/halfW;
    // Use the same real-world tile dimensions on both triangular and
    // trapezoidal hip slopes. Shorter faces crop the painted sheet.
    const horizontalSpan=2*Math.max(bw,bd);
    const endSlope=Math.hypot(bd-ridgeHalf,y-eaveY);
    const sideSlope=Math.hypot(bw,y-eaveY);
    const referenceSlopeLength=Math.max(endSlope,sideSlope);
    const endUv={horizontalSpan,slopeLength:endSlope,referenceSlopeLength};
    const sideUv={horizontalSpan,slopeLength:sideSlope,referenceSlopeLength};
    roofSurface(root, [[bw,eaveY,-bd],[-bw,eaveY,-bd],[0,y,-ridgeHalf]],'end',endUv);
    roofSurface(root, [[-bw,eaveY,bd],[bw,eaveY,bd],[0,y,ridgeHalf]],'end',endUv);
    roofSurface(root, [[-bw,eaveY,-bd],[-bw,eaveY,bd],[0,y,ridgeHalf],[0,y,-ridgeHalf]],'side',sideUv);
    roofSurface(root, [[bw,eaveY,bd],[bw,eaveY,-bd],[0,y,-ridgeHalf],[0,y,ridgeHalf]],'side',sideUv);
    box(root,[.2,.17,ridgeHalf*2+.2],[0,y+.02,0],mats.roofEdge);
    // Butt-jointed eave strips share a flush outer perimeter. Their old
    // mismatched lengths left squared-off stubs at the four corners.
    for(const x of [-bw,bw]){
      const fascia=box(root,[.12,.15,2*bd-.12],[x,eaveY,0],mats.roofEdge);
      fascia.userData.roofEaveFascia='side';
    }
    for(const z of [-bd,bd]){
      const fascia=box(root,[2*bw+.12,.15,.12],[0,eaveY,z],mats.roofEdge);
      fascia.userData.roofEaveFascia='end';
    }
    for(const x of [-bw,bw])for(const z of [-bd,bd]) {
      // Recess the diagonal hip beam tip into the eave trim, avoiding a
      // projecting square end at the roof corner.
      const inset=.02;
      beam(root,[x*(1-inset),eaveY+(y-eaveY)*inset,
        z+(Math.sign(z)*ridgeHalf-z)*inset],
        [0,y,Math.sign(z)*ridgeHalf],.085,mats.roofEdge);
    }
  }

  return {createRoof};
}
