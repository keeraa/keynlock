  class GameDefeat{
    constructor(root,{onRestart,onReturnToLair}={}){
      this.root=root;
      this.title=root?.querySelector('#gameDefeatTitle');
      this.text=root?.querySelector('#gameDefeatText');
      this.restart=root?.querySelector('#gameDefeatRestart');
      this.onRestart=onRestart;
      this.onReturnToLair=onReturnToLair;
      this.active=false;
      this.reason='generic';
      this.restart?.addEventListener('click',()=>{
        if(!this.active)return;
        const returnToLair=this.reason==='picks';
        this.reset();
        if(returnToLair)this.onReturnToLair?.();
        else this.onRestart?.();
      });
    }
    show(reason='generic',options={}){
      if(this.active||!this.root)return false;
      const message={
        picks:{title:'Отмычки закончились',text:'Вернись в логово и подготовься получше: создай новые отмычки из деталей или купи их на верстаке.'},
        time:{title:'Время вышло',text:'Ты не успел завершить взлом до окончания отсчёта.'},
        noise:{title:'Стража услышала',text:'Шум достиг критического уровня, и попытка сорвана.'},
        generic:{title:'Попытка провалена',text:'Попробуй пройти головоломку ещё раз.'}
      }[reason]||{title:'Попытка провалена',text:'Попробуй пройти головоломку ещё раз.'};
      this.active=true;
      this.reason=reason;
      if(typeof SFX!=='undefined') SFX.defeat?.();
      this.root.dataset.reason=reason;
      this.title.textContent=options.title||message.title;
      this.text.textContent=options.text||message.text;
      if(this.restart)this.restart.textContent=options.actionLabel||(reason==='picks'?'Вернуться в логово':'Пройти заново');
      this.root.hidden=false;
      document.body.classList.add('game-defeat');
      requestAnimationFrame(()=>this.restart?.focus({preventScroll:true}));
      return true;
    }
    reset(){
      this.active=false;
      this.reason='generic';
      if(this.root){this.root.hidden=true;delete this.root.dataset.reason;}
      document.body.classList.remove('game-defeat');
    }
    isActive(){return this.active;}
  }
