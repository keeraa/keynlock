import { createEventScope } from './event-scope.js';

/** Pointer and keyboard controls for the oil can, independent of its physics. */
export function createOilToolInput({canvas,document,window,button,tooltip,status,
  dispatch,cancelPointerClick,findOilSurface,beginContact,moveContact,
  loseContact,endContact}) {
  let oilToolActive=false,oilPointerId=null;
  let disposed=false;
  const events=createEventScope();
  function endOilContact() {
    if(oilPointerId!==null&&canvas.hasPointerCapture?.(oilPointerId))
      canvas.releasePointerCapture(oilPointerId);
    oilPointerId=null;
    endContact();
  }
  function toggleOilTool() {
    if(disposed)return;
    oilToolActive=!oilToolActive;
    if(!oilToolActive)endOilContact();
    button.classList.toggle('active',oilToolActive);
    button.setAttribute('aria-pressed',String(oilToolActive));
    button.setAttribute('aria-label',oilToolActive?
      'Маслёнка выбрана: удерживай кнопку мыши на детали':
      'Маслёнка: выбрать инструмент для смазки');
    canvas.classList.toggle('oil-cursor',oilToolActive);
    canvas.style.cursor=oilToolActive?'crosshair':'grab';
    tooltip.style.display='none';
    status(oilToolActive?'Маслёнка: удерживай ЛКМ на детали, чтобы капало масло.':
      'Маслёнка убрана.');
  }
  // The stand-alone harness uses a direct click; the game uses dispatch.
  if(!dispatch)events.listen(button,'click',toggleOilTool);
  events.listen(canvas,'pointerdown',event=>{
    if(!oilToolActive||event.button!==0||event.metaKey)return;
    event.preventDefault();event.stopImmediatePropagation();
    tooltip.style.display='none';cancelPointerClick();
    const hit=findOilSurface(event);
    if(!hit){status('Наведи маслёнку на деталь механизма.');return;}
    beginContact(hit);
    oilPointerId=event.pointerId;
    if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);
    status('Масло капает на выбранное место. Удерживай кнопку для смазки.');
  },true);
  events.listen(canvas,'pointermove',event=>{
    if(event.metaKey){
      tooltip.style.display='none';
      canvas.style.cursor=event.buttons?'grabbing':'grab';
      return;
    }
    if(!oilToolActive)return;
    event.stopImmediatePropagation();
    if(oilPointerId===event.pointerId&&(event.buttons&1)){
      const hit=findOilSurface(event);
      if(hit)moveContact(hit);
      else loseContact();
    }
    tooltip.style.display='none';canvas.style.cursor='crosshair';
  },true);
  events.listen(document,'keyup',event=>{
    if(event.key==='Meta')canvas.style.cursor=oilToolActive?'crosshair':'grab';
  });
  events.listen(document,'pointerup',event=>{
    if(oilPointerId!==event.pointerId)return;
    event.stopImmediatePropagation();
    endOilContact();
  },true);
  events.listen(document,'pointercancel',event=>{
    if(oilPointerId===event.pointerId)endOilContact();
  },true);
  events.listen(window,'blur',endOilContact);
  events.listen(document,'keydown',event=>{
    if(event.code==='Escape'&&oilToolActive){
      if(dispatch)dispatch({type:'oil-tool-toggle'},{source:'keyboard'});
      else button.click();
    }
  });
  function dispose(){
    if(disposed)return;
    disposed=true;
    events.dispose();
    endOilContact();
    if(oilToolActive){
      oilToolActive=false;
      button.classList.toggle('active',false);
      button.setAttribute('aria-pressed','false');
      canvas.classList.toggle('oil-cursor',false);
      canvas.style.cursor='grab';
    }
  }
  return {toggleOilTool,dispose};
}
