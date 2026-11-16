/** Keep gameplay controls and visual inspection settings in separate, accessible panels. */
export function attachSettingsTabs({document, rail, onUserActivate=()=>{}}) {
  const buttons=[...document.querySelectorAll('[data-settings-tab]')];
  const pages=new Map([
    ['lock',document.getElementById('settingsLock')],
    ['visual',document.getElementById('settingsVisual')],
    ['story',document.getElementById('settingsStory')],
  ]);
  function activate(name,focus=false) {
    if(!pages.has(name))return;
    for(const button of buttons){
      const selected=button.dataset.settingsTab===name;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
      if(selected&&focus)button.focus();
    }
    for(const [pageName,page] of pages)page.hidden=pageName!==name;
    rail.scrollTop=0;
  }
  function selectTab(name,focus=false) {
    activate(name,focus);
    onUserActivate(name);
  }
  for(const button of buttons){
    button.addEventListener('click',event=>{
      selectTab(button.dataset.settingsTab);
      // A mouse-clicked tab must not trap arrow keys meant for the pin puzzle.
      if(event.detail>0)button.blur?.();
    });
    button.addEventListener('keydown',event=>{
      if(event.code!=='ArrowLeft'&&event.code!=='ArrowRight')return;
      event.preventDefault();
      event.stopPropagation();
      const order=[...pages.keys()];
      const current=order.indexOf(button.dataset.settingsTab);
      const delta=event.code==='ArrowRight'?1:-1;
      selectTab(order[(current+delta+order.length)%order.length],true);
    });
  }
  activate('lock');
  return {activate};
}
