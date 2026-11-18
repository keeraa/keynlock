// Isolated controller for the real five-wheel SIKISI transmission.
export function createGearsMode({state,scene,$,listen,toast}){
  let last='';
  function render(){
    const status=scene.getGearState?.();if(!status)return;
    const signature=`${status.progress}|${status.lubricated}|${status.open}|${state.heldTool}`;
    if(signature===last)return;
    last=signature;
    $('gearProgressValue').textContent=`${status.progress}%`;
    $('gearProgressFill').style.width=`${status.progress}%`;
    $('gearOilValue').textContent=`${status.lubricated} / ${status.total}`;
    $('gearFeedback').textContent=status.open?
      'Замок открыт. Последняя шестерня отвела ригель, дужка вышла из гнезда.':
      `${status.status}. ${status.lubricated?`Смазано ${status.lubricated} из ${status.total}.`:
        'Можно смазать шестерни маслёнкой для более лёгкого хода.'}`;
    $('gearFeedback').classList.toggle('good',status.open);
    const held=state.heldTool==='oiler';
    $('gearOilButton').setAttribute('aria-pressed',String(held));
    $('gearOilButton').textContent=held?'Вернуть маслёнку':'Взять маслёнку';
    $('gearOilButton').classList.toggle('active',held);
    $('gearTurnButton').disabled=status.open||held;
  }
  function holdOil(next){
    state.heldTool=next?'oiler':null;
    scene.setOilerHeld?.(next);
    last='';render();
  }
  listen($('gearTurnButton'),'click',()=>{
    const next=scene.turnGear?.(.14);
    last='';render();
    if(next?.open)toast('Шестерёнки отвели ригель. Дужка замка открыта!');
  });
  listen($('gearOilButton'),'click',()=>{
    holdOil(state.heldTool!=='oiler');
    toast(state.heldTool==='oiler'?'Маслёнка в руке. Нажмите на шестерню.':
      'Маслёнка стоит на столе.');
  });
  listen($('gearResetButton'),'click',()=>{
    holdOil(false);scene.resetGear?.();last='';render();
    toast('Привод возвращён в начальное положение.');
  });
  return {render,holdOil,enter(){last='';render();},leave(){holdOil(false);},
    getDescription:()=>
      'Пять зацепленных шестерёнок вращают кулачок, отводят ригель и освобождают дужку.'};
}
