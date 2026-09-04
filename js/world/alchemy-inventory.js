/* Ingredient rack, bottle selection and station element slots. */

/* Ingredient rack drawer: lives outside #alchemyRoot entirely now (see
   css/alchemy-inventory.css for why — it's a bottom drawer over the whole lair
   scene, not a station inside the modal, so a container transform on the
   modal would break position:fixed if it were nested inside). Built and
   wired the same way as the lockpick case in js/world/inventory.js:
   peek/open toggle, closes on an outside click. Visibility itself needs no
   JS — the CSS gate on body:has(...) shows it exactly while the alchemy
   module is the open one.

   Picking a bottle by its Latin name (the name itself isn't printed on the
   shelf — the medallion carries its alchemical symbol instead, and the
   selected glow is the only feedback) just remembers the choice for now,
   in window.Alchemy.selectedElement. What it unlocks (which elixir recipes
   it gates) is the planned next step, mirrored on the tension-tool type
   match in js/core/inventory-hit-testing.js: a lock only opens for the
   matching tool, an elixir will only brew from the matching element. */
(function(){
  const drawer = document.querySelector('#alchemyRackDrawer');
  const toggle = document.querySelector('#alchemyRackDrawerToggle');
  const bottles = [...document.querySelectorAll('.alchemyRackDrawerBottle')];
  if(!drawer || !toggle || !bottles.length) return;

  function setOpen(force){
    const next = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
    drawer.classList.toggle('open', next);
    toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    toggle.setAttribute('aria-label', next ? 'Закрыть стойку ингредиентов' : 'Открыть стойку ингредиентов');
  }
  toggle.addEventListener('click', () => setOpen());

  document.addEventListener('pointerdown', e => {
    if(!drawer.classList.contains('open')) return;
    if(drawer.contains(e.target)) return;
    setOpen(false);
  }, true);

  function applyElement(el){
    bottles.forEach(b => b.classList.toggle('selected', b === el));
    window.Alchemy = window.Alchemy || {};
    window.Alchemy.selectedElement = el.dataset.element;
    window.Alchemy.applySelection?.(el.dataset.element);
  }
  function select(el){
    // Also opens: a bottle poking into the peek strip is clickable now (see
    // the z-index note on .alchemyRackDrawerToggle) even before the drawer
    // is officially "open", and picking one from there without the drawer
    // catching up read as the click having done nothing.
    setOpen(true);
    applyElement(el);
  }
  // Dragging a bottle out and dropping it directly on a station's element
  // cell selects it the same way a click does — a click is still the way
  // in for anyone who doesn't drag. Pointer events, not the HTML5 drag-
  // and-drop API: that API has no real touch support, and this rack is
  // used from a phone as often as a mouse. touch-action:none (CSS) keeps
  // the browser from stealing the gesture as a page scroll once a touch
  // starts moving.
  let suppressClick = false;
  // Twice as wide as the cell's own art — a bottle is a narrow ~40-70px
  // column, an unforgiving target to hit exactly on a phone. Only the
  // horizontal catch area grows (padded by half the cell's own width on
  // each side); the cell's visible size and vertical bounds are untouched.
  function findDropCell(x, y){
    for(const cell of document.querySelectorAll('.alchemyElementCell')){
      const r = cell.getBoundingClientRect();
      if(!r.width || !r.height) continue;
      const padX = r.width / 2;
      if(x >= r.left - padX && x <= r.right + padX && y >= r.top && y <= r.bottom) return cell;
    }
    return null;
  }
  bottles.forEach(b => {
    b.addEventListener('click', () => {
      if(suppressClick){ suppressClick = false; return; }
      select(b);
    });
    b.addEventListener('pointerdown', e => {
      if(b.classList.contains('selected')) return;
      const startX = e.clientX, startY = e.clientY;
      let dragging = false, ghost = null;
      const clearDragOver = () => document.querySelectorAll('.alchemyElementCell.dragOver')
        .forEach(c => c.classList.remove('dragOver'));
      const onMove = ev => {
        if(!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8){
          dragging = true;
          ghost = b.cloneNode(true);
          // Adding the ghost class rather than replacing className outright:
          // .alchemyRackDrawerBottle img{width:100%;height:100%;object-fit:
          // contain} only matches while the clone still carries that class
          // too. Dropped, the <img> fell back to its own intrinsic pixel
          // size — hundreds of px of source art with no containing box to
          // scale it, which is the "huge bottle with a white square" bug.
          ghost.classList.add('alchemyRackDrawerBottleDragGhost');
          ghost.style.width = b.offsetWidth + 'px';
          ghost.style.height = b.offsetHeight + 'px';
          document.body.appendChild(ghost);
        }
        if(!dragging) return;
        ev.preventDefault();
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
        const cell = findDropCell(ev.clientX, ev.clientY);
        clearDragOver();
        if(cell) cell.classList.add('dragOver');
      };
      const onUp = ev => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if(!dragging) return;
        suppressClick = true;
        const cell = findDropCell(ev.clientX, ev.clientY);
        clearDragOver();
        if(cell){
          // Flies from wherever the pointer let go to the cell it landed
          // on and shrinks to match it, instead of the bottle just
          // vanishing and the cell art popping in cold. select() (which
          // paints the cell) waits for the flight to land so the two
          // don't visually overlap mid-transit.
          const cellRect = cell.getBoundingClientRect();
          const scale = Math.min(1, cellRect.height / b.offsetHeight);
          ghost.style.transition = 'left .24s cubic-bezier(.3,.6,.28,1),top .24s cubic-bezier(.3,.6,.28,1),transform .24s cubic-bezier(.3,.6,.28,1),opacity .24s ease .06s';
          void ghost.offsetWidth; // force the start position to commit before animating
          ghost.style.left = (cellRect.left + cellRect.width / 2) + 'px';
          ghost.style.top = (cellRect.top + cellRect.height / 2) + 'px';
          ghost.style.transform = `translate(-50%,-50%) scale(${scale})`;
          ghost.style.opacity = '0';
          setTimeout(() => { ghost.remove(); select(b); }, 240);
        } else {
          ghost.style.transition = 'opacity .16s ease';
          ghost.style.opacity = '0';
          setTimeout(() => ghost.remove(), 160);
        }
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  });

  // The station element slots (this file, further down) open the
  // rack the same way the drawer's own peek does, rather than duplicating
  // the open logic.
  window.Alchemy = window.Alchemy || {};
  window.Alchemy.openRackDrawer = () => setOpen(true);
  // Reset/Новая партия/Новая смесь put the bottle back on the shelf — a
  // fresh round hasn't picked one yet. Only the resetting station's own
  // selection clears (the accessor above resolves selectedElement=null
  // against whichever station is active, i.e. this one), so the rack's
  // single highlighted bottle — which only ever reflects the active
  // station's own pick — is what needs un-highlighting here too.
  window.Alchemy.clearSelection = () => {
    bottles.forEach(b => b.classList.remove('selected'));
    window.Alchemy.selectedElement = null;
    window.Alchemy.applySelection?.(null);
  };
  // Switching stations doesn't touch any selection, but the rack is one
  // shared strip of UI shown regardless of which station is active — its
  // highlighted bottle has to catch up to whatever *that* station last
  // picked (or didn't).
  window.Alchemy.syncRackSelection = () => {
    const el = window.Alchemy.selectedElement;
    bottles.forEach(b => b.classList.toggle('selected', !!el && b.dataset.element === el));
  };
})();

/* Element slots: each color-game station carries one empty cell (see
   reframe() above — it lands in .alchemyElementColumn alongside the verdict
   and the check button) that has to hold one of the rack's seven elements
   before its Check button will do anything. Clicking an empty cell opens
   the rack the same way clicking the drawer's own peek does; picking a
   bottle there (see the accessor IIFE above) now fills only the station
   that was showing when it was picked — each scene's own cell and Check
   button are painted from that scene's own stored selection, not a shared
   one. */
(function(){
  const scenes = [...document.querySelectorAll('#alchemyRoot .scene')];
  if(!scenes.length) return;

  // .big-actions holds exactly two buttons per station — Проверить (plain
  // .ctl) and the reset icon (.ctl.ctl-icon) — so :not(.ctl-icon) finds
  // this scene's own Check button without hardcoding its id.
  function stationParts(scene){
    return {
      cell: scene.querySelector('.alchemyElementCell'),
      checkBtn: scene.querySelector('.big-actions .ctl:not(.ctl-icon)')
    };
  }

  function paint(cell, checkBtn, element){
    if(cell){
      const wasFilled = cell.classList.contains('filled');
      if(element){
        cell.classList.add('filled');
        // Root-relative, not "assets/...": a relative url() written into a
        // custom property resolves against the stylesheet that *uses* the
        // var() (css/alchemy-workshop.css, one level down from the project root),
        // not the page — the relative form landed inside css/ itself, a 404.
        cell.style.setProperty('--element-bottle-img', `url("/assets/alchemy/bottle-${element}.png")`);
        cell.setAttribute('aria-label', `Элемент: ${element.charAt(0).toUpperCase()+element.slice(1)} · сменить`);
        // A brief landing pop, same trigger whether the bottle arrived by
        // drag or by a plain click-select — retriggered by forcing a
        // reflow between removing and re-adding the class, since re-adding
        // an already-present class doesn't restart a CSS animation.
        if(!wasFilled){
          cell.classList.remove('landing'); void cell.offsetWidth; cell.classList.add('landing');
          setTimeout(() => cell.classList.remove('landing'), 340);
        }
      } else {
        cell.classList.remove('filled');
        cell.style.removeProperty('--element-bottle-img');
        cell.setAttribute('aria-label', 'Добавить элемент из стойки');
      }
    }
    if(checkBtn) checkBtn.disabled = !element;
  }

  function applySelection(element){
    // Only the active scene reacts: picking/clearing always targets
    // whichever station is showing (window.Alchemy.selectedElement's
    // setter already resolved `element` against that same station).
    const scene = document.querySelector('#alchemyRoot .scene.active');
    if(!scene) return;
    const {cell, checkBtn} = stationParts(scene);
    paint(cell, checkBtn, element);
  }
  window.Alchemy = window.Alchemy || {};
  window.Alchemy.applySelection = applySelection;

  // Dragging a filled cell's own bottle back down onto the rack returns it
  // — the mirror of picking one out. A plain click still opens the rack
  // either way (to swap for a different element without returning first);
  // suppressClick is the same pattern the rack's own bottles use to keep
  // a completed drag from also firing as a click afterward.
  function wireReturn(cell){
    let suppressClick = false;
    cell.addEventListener('click', () => {
      if(suppressClick){ suppressClick = false; return; }
      window.Alchemy.openRackDrawer?.();
    });
    cell.addEventListener('pointerdown', e => {
      if(!cell.classList.contains('filled')) return;
      const startX = e.clientX, startY = e.clientY;
      let dragging = false, ghost = null;
      const onMove = ev => {
        if(!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8){
          dragging = true;
          ghost = document.createElement('div');
          ghost.className = 'alchemyRackDrawerBottleDragGhost';
          ghost.style.width = cell.offsetWidth + 'px';
          ghost.style.height = cell.offsetHeight + 'px';
          ghost.style.backgroundImage = cell.style.getPropertyValue('--element-bottle-img');
          document.body.appendChild(ghost);
        }
        if(!dragging) return;
        ev.preventDefault();
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
      };
      const onUp = ev => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if(!dragging) return;
        suppressClick = true;
        const overRack = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#alchemyRackDrawer');
        if(overRack){
          ghost.style.transition = 'opacity .18s ease,transform .18s ease';
          // Overrides the class's own translate(-50%,-50%) (inline always
          // wins), so the scale has to be folded back in explicitly here.
          ghost.style.transform = 'translate(-50%,-50%) scale(.6)';
          ghost.style.opacity = '0';
          setTimeout(() => { ghost.remove(); window.Alchemy.clearSelection?.(); }, 180);
        } else {
          ghost.remove();
        }
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  // Each station starts from its own stored selection (all empty at
  // boot), independently of the others.
  scenes.forEach(scene => {
    const {cell, checkBtn} = stationParts(scene);
    paint(cell, checkBtn, window.Alchemy.selections?.[scene.dataset.name] || null);
    if(cell) wireReturn(cell);
  });
})();
