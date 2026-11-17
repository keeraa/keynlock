/** Same-browser restoration preview. The atelier is the sole source of truth. */
const ATELIER_ORIGIN='https://atelier-restoration-1115.k1r11111.chatgpt.site';
const BRIDGE='keynlock:atelier-bridge:v1';

export function connectAtelier(room,{onStatus=()=>{},onState=()=>{}}={}) {
  const iframe=document.createElement('iframe');
  iframe.title='Связь с ателье реставрации';
  iframe.tabIndex=-1;
  iframe.setAttribute('aria-hidden','true');
  iframe.style.cssText='position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.setAttribute('sandbox','allow-scripts allow-same-origin');
  iframe.src=`${ATELIER_ORIGIN}/bridge.html`;
  let connected=false;
  const pendingRequests=new Map();
  const outboundQueue=[];
  function send(type,payload={}){
    const message={bridge:BRIDGE,type,...payload};
    if(!connected){outboundQueue.push(message);return;}
    iframe.contentWindow?.postMessage(message,ATELIER_ORIGIN);
  }
  function flushQueue(){
    while(outboundQueue.length)iframe.contentWindow?.postMessage(outboundQueue.shift(),ATELIER_ORIGIN);
  }
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
      onState(data);
      room.atelierWall?.setState(data);
      flushQueue();
      const count=data.placements?.length||0;
      onStatus(data.mode==='player'
        ? `Синхронизировано · ${count} картин на стене`
        : 'Синхронизировано · демонстрационная галерея');
    }else if(data.type==='snapshot') {
      void room.atelierWall?.setSnapshot(data);
      const requests=pendingRequests.get(data.id);
      if(requests){pendingRequests.delete(data.id);for(const done of requests)done(data.snapshot||null);}
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
    requestSnapshot(id){
      return new Promise(resolve=>{
        const callbacks=pendingRequests.get(id)||[];
        let timer;
        const done=snapshot=>{clearTimeout(timer);resolve(snapshot);};
        callbacks.push(done);pendingRequests.set(id,callbacks);
        timer=setTimeout(()=>{
          const remaining=(pendingRequests.get(id)||[]).filter(item=>item!==done);
          if(remaining.length)pendingRequests.set(id,remaining);else pendingRequests.delete(id);
          done(null);
        },8000);
        send('readSnapshot',{id});
      });
    },
    saveSnapshot(id,snapshot){send('saveSnapshot',{id,snapshot});},
    saveProgress(save){send('saveProgress',{save});},
    refresh(){
      iframe.contentWindow?.postMessage({bridge:BRIDGE,type:'request'},ATELIER_ORIGIN);
    },
    dispose(){
      clearTimeout(disconnectedTimer);
      for(const requests of pendingRequests.values())for(const done of requests)done(null);
      pendingRequests.clear();
      window.removeEventListener('message',receive);
      iframe.remove();
    },
  };
}
