// All eight pin puzzles use one deterministic rule engine with injected randomness.
export function createPinPuzzleRules({ THREE, rand, getPuzzle }) {
  // Eight game-rule sets share the same 3D pin, driver, spring and lock rig.
  // The free inspection mode above keeps its original, physically aligned cuts.
  const pinPuzzleSymbols=['✦','◆','✧','◈','☀','△','✶'];
  function puzzleRandom(min,max){return min+rand()*(max-min);}
  function puzzleShuffle(size){
    const a=Array.from({length:size},(_,i)=>i);
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
  function puzzleConnections(g,index,direction){
    const shifts=new Map([[index,direction]]),n=g.count;
    const add=(i,step)=>shifts.set(i,(shifts.get(i)||0)+step);
    if(g.type==='classic'){
      add(index===n-1?index-1:index+1,(index%2?-1:1)*direction);
    }else if(g.type==='special'){
      if(g.linkType==='chain'){
        if(index>0)add(index-1,direction);
        if(index<n-1)add(index+1,direction);
      }else if(g.linkType==='mirror'){
        if(n-1-index!==index)add(n-1-index,-direction);
      }else if(g.linkType==='wave'){
        add((index+1)%n,direction);
        add((index+n-1)%n,-direction);
      }
    }
    return shifts;
  }
  function puzzleLinkedStep(g,index,direction){
    const shifts=puzzleConnections(g,index,direction);
    for(const [i,shift] of shifts){
      if(g.values[i]+shift<1||g.values[i]+shift>7)return false;
    }
    for(const [i,shift] of shifts)g.values[i]+=shift;
    return true;
  }
  function puzzleGenerate(g){
    const n=g.count,l=g.level;
    g.selected=0;g.values=Array(n).fill(0);g.targets=Array(n).fill(0);
    g.fixed=Array(n).fill(false);g.elapsed=0;g.expired=false;
    g.needle=50;g.value=50;g.motion=Array(n).fill(0);
    g.phases=[];g.order=Array.from({length:n},(_,i)=>i);
    g.timeLeft=0;
    if(g.type==='classic'||g.type==='special'){
      g.linkType=g.type==='special'?['chain','mirror','wave'][Math.floor(rand()*(l===1?1:l===2?2:3))]:'paired';
      const goal=g.type==='classic'?(l===3?[2,3,5,6][Math.floor(rand()*4)]:4):4;
      g.targets.fill(goal);g.values=g.targets.slice();
      for(let j=0;j<n*3+l*4;j++){
        puzzleLinkedStep(g,Math.floor(rand()*n),rand()<.5?-1:1);
      }
      if(g.values.every((v,i)=>v===g.targets[i])){
        for(let i=0;i<n;i++)if(puzzleLinkedStep(g,i,goal===7?-1:1))break;
      }
      g.initial=g.values.slice();
    }else if(g.type==='sequence'){
      g.targets=Array.from({length:n},()=>2+Math.floor(rand()*4));
      g.values=g.targets.map(target=>THREE.MathUtils.clamp(target+
        (rand()<.5?-1:1)*(1+Math.floor(rand()*(l+1))),1,7));
      g.initial=g.values.slice();
    }else if(g.type==='tension'){
      g.bandWidth=[puzzleRandom(22,32),puzzleRandom(14,22),puzzleRandom(10,16)][l-1];
      g.bandCenter=puzzleRandom(24,76);g.needle=50;
    }else if(g.type==='resonance'){
      g.tolerance=[10,7,5][l-1];
      g.needle=50+45*Math.sin(puzzleRandom(.4,2.4));
      g.resonancePhase=puzzleRandom(0,Math.PI*2);
      g.resonanceSpeed=[2.15,3.1,4.0][l-1];
    }else if(g.type==='pinflight'){
      g.phases=Array.from({length:n},()=>({phase:'idle',time:0,
        up:puzzleRandom(.27,.39),window:puzzleRandom(.076,.112),down:puzzleRandom(.25,.40)}));
    }else if(g.type==='springtumblers'){
      g.timeLeft=[20,16,12][l-1];
      g.targets=Array.from({length:n},()=>puzzleRandom(25,75));
      g.values=g.targets.map(target=>THREE.MathUtils.clamp(target+
        (rand()<.5?-1:1)*puzzleRandom(13,32),8,92));
      g.inverted=Array(n).fill(false);
      const inversionOrder=puzzleShuffle(n);
      for(let i=0;i<(l===1?1:2);i++)g.inverted[inversionOrder[i]]=true;
    }else if(g.type==='symbolpins'){
      g.timeLeft=[30,26,22][l-1];
      g.targets=Array.from({length:n},()=>puzzleRandom(22,78));
      g.values=g.targets.map(target=>THREE.MathUtils.clamp(target+
        (rand()<.5?-1:1)*puzzleRandom(11,29),4,96));
      g.order=puzzleShuffle(n);
    }
  }
  function puzzleReady(g=getPuzzle()){
    if(!g||g.over)return false;
    if(['classic','sequence','special'].includes(g.type)){
      return g.values.every((value,i)=>value===g.targets[i]);
    }
    return g.fixed.every(Boolean);
  }
  function puzzleActiveIndex(g=getPuzzle()){
    if(!g)return 0;
    return g.selected;
  }
  function puzzlePinLift(st){
    const g=getPuzzle(),i=st.i;
    if(!g||i>=g.count)return 0;
    if(puzzleReady(g)||g.fixed[i])return st.requiredLift;
    if(['classic','sequence','special'].includes(g.type)){
      return THREE.MathUtils.clamp(st.requiredLift+(g.values[i]-g.targets[i])*.038,0,st.requiredLift+.19);
    }
    if(g.type==='springtumblers'||g.type==='symbolpins'){
      return THREE.MathUtils.clamp(st.requiredLift+(g.values[i]-g.targets[i])*.0037,0,st.requiredLift+.19);
    }
    if(g.type==='pinflight')return st.requiredLift*g.motion[i];
    if(g.type==='resonance'&&i===puzzleActiveIndex(g)){
      return THREE.MathUtils.clamp(st.requiredLift+(g.needle-50)*.0025,0,st.requiredLift+.14);
    }
    if(g.type==='tension'&&i===puzzleActiveIndex(g)){
      return st.requiredLift*(.18+.76*(1-Math.abs(g.needle-g.bandCenter)/100));
    }
    return 0;
  }
  return { pinPuzzleSymbols, puzzleRandom, puzzleShuffle, puzzleConnections, puzzleLinkedStep,
    puzzleGenerate, puzzleReady, puzzleActiveIndex, puzzlePinLift };
}
