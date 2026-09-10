  class GameDefeat{
    constructor(root,{onRestart,onReturnToLair}={}){
      this.root=root;
      this.title=root?.querySelector('#gameDefeatTitle');
      this.text=root?.querySelector('#gameDefeatText');
      this.loss=root?.querySelector('#gameDefeatLoss');
      this.lossValue=root?.querySelector('#gameDefeatLossValue');
      this.restart=root?.querySelector('#gameDefeatRestart');
      this.onRestart=onRestart;
      this.onReturnToLair=onReturnToLair;
      this.active=false;
      this.reason='generic';
      this.restart?.addEventListener('click',()=>{
        if(!this.active)return;
        const returnToLair=['picks','noise'].includes(this.reason);
        this.reset();
        if(returnToLair)this.onReturnToLair?.();
        else this.onRestart?.();
      });
    }
    show(reason='generic',options={}){
      if(this.active||!this.root)return false;
      const message={
        picks:{title:'Отмычки закончились',text:'Вернись в логово и пополни запас отмычек на верстаке.'},
        time:{title:'Время вышло',text:'Ты не успел завершить взлом до окончания отсчёта.'},
        noise:{title:'Стража услышала',text:'Шум достиг критического уровня, и попытка сорвана.'},
        generic:{title:'Попытка провалена',text:'Попробуй пройти головоломку ещё раз.'}
      }[reason]||{title:'Попытка провалена',text:'Попробуй пройти головоломку ещё раз.'};
      this.active=true;
      this.reason=reason;
      if(this.loss)this.loss.hidden=true;
      if(reason==='noise')message.text=this.resolveGuardEncounter();
      if(typeof SFX!=='undefined') SFX.defeat?.();
      this.root.dataset.reason=reason;
      this.title.textContent=options.title||message.title;
      this.text.textContent=reason==='noise'?message.text:options.text||message.text;
      if(this.restart)this.restart.textContent=reason==='noise'?'Вернуться в логово':options.actionLabel||(reason==='picks'?'Вернуться в логово':'Пройти заново');
      this.root.hidden=false;
      document.body.classList.add('game-defeat');
      requestAnimationFrame(()=>this.restart?.focus({preventScroll:true}));
      return true;
    }
    resolveGuardEncounter(){
      const outcome=balance>0?Math.floor(Math.random()*3):0;
      let text;
      if(outcome===0){
        const lost=window.KeynlockResources.consumePicks(window.KeynlockResources.state.picks);
        picks=Math.min(picks,window.KeynlockResources.state.picks);
        updatePickUI();
        text=window.KeynlockResources.state.picks>0
          ? `Вы сбежали и сохранили последнюю отмычку. До первой победы она останется с вами.${lost>0?` Потеряно отмычек: ${lost}.`:''}`
          : `Вы сбежали, но обронили все ваши инструменты. Потеряно отмычек: ${lost}.`;
      }else{
        // Coins are indivisible: round an odd balance's half up.
        const lost=outcome===1?Math.ceil(balance/2):balance;
        balance-=lost;
        if(this.loss&&this.lossValue){
          this.loss.hidden=false;
          this.loss.setAttribute('aria-label',`Потеряно монет: ${lost}`);
          this.lossValue.textContent=`−${lost}`;
        }
        STORE.setItem('lockpickBalance',String(balance));
        updateEconomyUI();
        window.KeynlockResources.render();
        text=outcome===1
          ?`Вы смогли договориться со стражей о взятке. `
          :`Вы пытались подкупить стражу, но они забрали у вас все деньги. `;
      }
      return `Вы привлекли внимание шумным взломом. ${text}`;
    }
    reset(){
      this.active=false;
      this.reason='generic';
      if(this.root){this.root.hidden=true;delete this.root.dataset.reason;}
      document.body.classList.remove('game-defeat');
    }
    isActive(){return this.active;}
  }
