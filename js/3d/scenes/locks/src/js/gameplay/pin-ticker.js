/** Real-time movement and deadlines for pin mini-games, isolated from input handling. */
export function createPinPuzzleTicker({THREE,state,getPuzzle,puzzleReady,puzzleDamage,puzzleNotice}) {
  return function tickPinPuzzle(dt){
    const g=getPuzzle();
    if(!g||g.over||g.completed||!state.insertTarget||state.insertP<.90)return;
    g.elapsed+=dt;
    if(g.type==='tension'){
      const drift=Math.sin(g.elapsed*(1.7+g.level*.4))*9+
        Math.sin(g.elapsed*(3.3+g.level*.7))*(3+g.level*1.4);
      g.needle=THREE.MathUtils.clamp(g.value+drift,0,100);
    }else if(g.type==='resonance'){
      const speed=g.resonanceSpeed*(1+(g.level>1?.12*Math.sin(g.elapsed*.55):0));
      g.needle=50+46*Math.sin(g.resonancePhase+g.elapsed*speed);
    }else if(g.type==='pinflight'){
      for(let i=0;i<g.count;i++){
        const flight=g.phases[i];
        if(g.fixed[i]){g.motion[i]=1;continue;}
        if(flight.phase==='idle'){g.motion[i]=0;continue;}
        flight.time+=dt;
        if(flight.phase==='up'){
          const t=Math.min(1,flight.time/flight.up);
          g.motion[i]=Math.sin(t*Math.PI*.5);
          if(flight.time>=flight.up){flight.phase='apex';flight.time-=flight.up;g.motion[i]=1;}
        }else if(flight.phase==='apex'){
          g.motion[i]=1;
          if(flight.time>=flight.window){flight.phase='down';flight.time-=flight.window;}
        }else if(flight.phase==='down'){
          const t=Math.min(1,flight.time/flight.down);
          g.motion[i]=Math.cos(t*Math.PI*.5);
          if(t>=1){flight.phase='idle';flight.time=0;g.motion[i]=0;}
        }
      }
    }
    if(g.timeLeft>0&&!puzzleReady(g)){
      g.timeLeft=Math.max(0,g.timeLeft-dt);
      if(g.timeLeft===0){
        if(g.type==='springtumblers')puzzleDamage('Время вышло, тумблеры перестроены','timeout');
        else if(g.type==='symbolpins'){
          g.expired=true;
          puzzleNotice('Время вышло: движение заблокировано. Нажми «Сброс».',true);
        }
      }
    }
  };
}
