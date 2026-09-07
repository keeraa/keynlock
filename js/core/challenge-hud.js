(function(){
  class GameChallengeHud{
    constructor(root){
      if(!root) throw new Error('GameChallengeHud requires a root element');
      this.root=root;
      this.objective=root.querySelector('#objectiveLine');
      this.reward=root.querySelector('#runReward');
      this.rewardBox=root.querySelector('#rewardBox');
      this.timer=root.querySelector('#challengeTimer');
      this.timerLabel=root.querySelector('#challengeTimerLabel');
      this.timerValue=root.querySelector('#challengeTimerValue');
      this.timerProgress=root.querySelector('#challengeTimerProgress');
    }

    setObjective(html){
      if(this.objective&&this.objective.innerHTML!==html) this.objective.innerHTML=html;
    }

    setReward(value){
      if(this.reward&&this.reward.textContent!==String(value)) this.reward.textContent=String(value);
    }

    pulseReward(){
      if(!this.rewardBox) return;
      this.rewardBox.classList.remove('drop');
      void this.rewardBox.offsetWidth;
      this.rewardBox.classList.add('drop');
    }

    setTimer({active=false,timeLeft=0,timeMax=1,label='Время'}={}){
      if(!this.timer) return;
      if(this.timerActive!==active){
        this.timerActive=active;
        this.timer.classList.toggle('hidden',!active);
        this.timer.setAttribute('aria-hidden',active?'false':'true');
        this.root.classList.toggle('timer-active',active);
      }
      if(!active) return;
      const remaining=Math.max(0,Number(timeLeft)||0);
      const maximum=Math.max(.001,Number(timeMax)||1);
      const fraction=Math.max(0,Math.min(1,remaining/maximum));
      const whole=Math.ceil(remaining);
      const minutes=Math.floor(whole/60);
      const seconds=whole%60;
      const time=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
      if(this.timerValue.textContent!==time)this.timerValue.textContent=time;
      const caption=label==='ТАЙМЕР'?'Время':label;
      if(this.timerLabel.textContent!==caption)this.timerLabel.textContent=caption;
      const width=`${(fraction*100).toFixed(2)}%`;
      if(this.timerProgress.style.width!==width)this.timerProgress.style.width=width;
      const level=fraction>.45?'normal':(fraction>.2?'warning':'danger');
      if(this.timer.dataset.level!==level)this.timer.dataset.level=level;
    }
  }

  window.GameChallengeHud=GameChallengeHud;
})();

