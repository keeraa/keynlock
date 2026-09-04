/* Alchemy window state and station switching. */

/* One bottle per station, not one bottle for all three: each of the color-
   game scenes carries its own element cell (reframe(), below), so the
   choice should stick to whichever station is showing when it's made.
   window.Alchemy.selectedElement stays the read/write name every Check
   handler already uses — it's now an accessor over a per-station map
   instead of one shared value, so picking (or resetting) in Mixing can no
   longer plant — or clear — a bottle in Separation. */
(function(){
  window.Alchemy = window.Alchemy || {};
  window.Alchemy.selections = window.Alchemy.selections || {};
  function activeStationKey(){
    return document.querySelector('#alchemyRoot .scene.active')?.dataset.name || '';
  }
  Object.defineProperty(window.Alchemy, 'selectedElement', {
    configurable:true,
    get(){ return window.Alchemy.selections[activeStationKey()] || null; },
    set(v){ window.Alchemy.selections[activeStationKey()] = v || null; }
  });
})();

/* Station switching inside the lair panel. Only three of the ten are wired up,
   so this drives them by index over whatever scenes are present. */
(function(){
  const root = document.querySelector('#alchemyRoot');
  if(!root) return;
  const guideViewer = document.querySelector('#alchemyGuideViewer');
  const closeGuideViewer = () => { if(guideViewer) guideViewer.hidden = true; };
  // Capture before the room's broad click/drag surfaces. The board itself is
  // deliberately behind the table layer, so delegating from document also
  // remains reliable when an image inside the button is the actual target.
  document.addEventListener('pointerdown', event => {
    const reference = event.target.closest?.('.alchemyMixReference:not(.alchemyBlankReference)');
    if(!reference || !root.contains(reference)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(guideViewer) guideViewer.hidden = false;
  }, true);
  // Handle close controls at the viewer boundary in capture phase. This keeps
  // the close action reliable even when other lair click handlers are mounted
  // above the station and prevents the click reaching the board beneath after
  // the viewer becomes hidden.
  guideViewer?.addEventListener('pointerdown', event => {
    if(!event.target.closest('.alchemyGuideViewerClose,.alchemyGuideViewerBackdrop')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeGuideViewer();
  }, true);
  document.addEventListener('keydown', event => { if(event.key === 'Escape' && guideViewer && !guideViewer.hidden){ event.preventDefault(); event.stopImmediatePropagation(); closeGuideViewer(); } });
  const tabs = [...document.querySelectorAll('#alchemyTopHud .alchemyStationTab')];
  const scenes = () => [...root.querySelectorAll('.scene')];
  function show(i){
    tabs.forEach((t, n) => t.classList.toggle('active', n === i));
    scenes().forEach((s, n) => s.classList.toggle('active', n === i));
    // The rack itself is one shared strip of UI — its highlighted bottle
    // has to catch up to whichever station just became active, since the
    // selection underneath is per-station now (see the accessor above).
    window.Alchemy?.syncRackSelection?.();
  }
  // The prototype was a catalogue: every station carried its own heading and
  // status line because they scrolled past one another. Here the window is the
  // frame, so the heading is dropped, the verdict is moved down beside the
  // actions where it can be pinned, and the reagents are lifted out of the
  // cluster that squared them around the flask.
  function reframe(scene){
    if(scene.dataset.reframed) return;
    scene.dataset.reframed = '1';
    scene.querySelector('.scene-head h2')?.closest('div')?.remove();
    const lab = scene.querySelector('.lab');
    const actions = scene.querySelector('.big-actions');
    const status = scene.querySelector('.status');
    const controls = scene.querySelector('.color-controls');
    const elementCell = scene.querySelector('.alchemyElementCell');
    // Reagents come out of the lab entirely. Inside it they sat in an absolute
    // grid of named corners around the flask, and no amount of overriding kept
    // them from painting over everything below. Out here they are a plain band
    // that always sits between the glassware and the verdict — and, alongside
    // it, a third column: the element slot, the verdict, then the buttons,
    // stacked in the order you actually use them.
    if(lab && actions && status){
      const column = document.createElement('div');
      column.className = 'alchemyElementColumn';
      if(elementCell) column.append(elementCell);
      column.append(status, actions);
      if(controls){
        const band = document.createElement('div');
        band.className = 'alchemyReagents';
        band.append(controls);
        scene.append(band);
      }
      scene.append(column);
    }
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  scenes().forEach(reframe);
  show(0);
})();
