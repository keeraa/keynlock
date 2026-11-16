/** Same-browser restoration preview. The atelier is the sole source of truth. */
const ATELIER_ORIGIN='https://atelier-restoration-1115.k1r11111.chatgpt.site';
const BRIDGE='keynlock:atelier-bridge:v1';

export function connectAtelier(room,{onStatus=()=>{}}={}) {
  const iframe=document.createElement('iframe');
  iframe.title='Связь с ателье реставрации';
  iframe.tabIndex=-1;
  iframe.setAttribute('aria-hidden','true');
  iframe.style.cssText='position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.sandbox='allow-scripts allow-same-origin';
  iframe.src=`${ATELIER_ORIGIN}/bridge.html`;
  let connected=false;
  let disconnectedTimer=setTimeout(()=>{
    if(!connected)onStatus('Ателье пока не подключено — обновите его вкладку');
  },10000);
  function receive(event) {
    if(event.origin!==ATELIER_ORIGIN || event.source!==iframe.contentWindow)return;
    const data=event.data;
    if(data?.bridge!==BRIDGE)return;
    if(data.type==='state') {
      connected=true;
      clearTimeout(disconnectedTimer);
      room.atelierWall?.setState(data);
      const count=data.placements?.length||0;
      onStatus(data.mode==='player'
        ? `Синхронизировано · ${count} картин на стене`
        : 'Синхронизировано · демонстрационная галерея');
    }else if(data.type==='snapshot') {
      void room.atelierWall?.setSnapshot(data);
    }else if(data.type==='error') {
      onStatus('Невозможно прочитать локальное сохранение Ателье');
    }
  }
  window.addEventListener('message',receive);
  iframe.addEventListener('load',()=>{
    iframe.contentWindow?.postMessage({bridge:BRIDGE,type:'request'},ATELIER_ORIGIN);
  });
  document.body.appendChild(iframe);
  return {
    refresh(){
      iframe.contentWindow?.postMessage({bridge:BRIDGE,type:'request'},ATELIER_ORIGIN);
    },
    dispose(){
      clearTimeout(disconnectedTimer);
      window.removeEventListener('message',receive);
      iframe.remove();
    },
  };
}
