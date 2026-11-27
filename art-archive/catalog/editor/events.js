function resetVisiblePage() {
  max = PAGE_SIZE;
  render();
}

function showExcludedStatus(value) {
  $('#status').value = $('#status').value === value ? 'all' : value;
  $('#search').value = '';
  $('#museum').value = '';
  $('#gameZone').value = '';
  $('#subject').value = '';
  filter.value = '';
  resetVisiblePage();
  $('#result').scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function bindEvents() {
  $('#excludedButton').addEventListener('click', () => showExcludedStatus('off'));
  let searchTimer = 0;
  $('#search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(resetVisiblePage, 150);
  });

  $('#filterMenu').addEventListener('click', event => {
    const option = event.target.closest('[data-action="filter-option"]');
    if (!option) return;
    filter.value = option.dataset.category;
    $('#filterDrop').open = false;
    resetVisiblePage();
  });
  $('#gameZoneMenu').addEventListener('click',event=>{
    const option=event.target.closest('[data-action="game-filter"]');if(!option)return;
    $('#gameZone').value=option.dataset.zone;$('#gameZoneDrop').open=false;resetVisiblePage();
  });
  $('#gameSummary').addEventListener('click',event=>{
    const option=event.target.closest('[data-action="game-chip"]');if(!option)return;
    const target=option.dataset.zone;
    $('#gameZone').value=$('#gameZone').value===target?'':target;resetVisiblePage();
  });
  $('#museumMenu').addEventListener('click', event => {
    const option = event.target.closest('[data-action="museum-option"]');
    if (!option) return;
    $('#museum').value = option.dataset.value;
    $('#museumDrop').open = false;
    resetVisiblePage();
  });
  $('#subjectMenu').addEventListener('click', event => {
    const option = event.target.closest('[data-action="subject-option"]');
    if (!option) return;
    $('#subject').value = option.dataset.value;
    $('#subjectDrop').open = false;
    resetVisiblePage();
  });
  $('#subjectSummary').addEventListener('click', event => {
    const option = event.target.closest('[data-action="subject-chip"]');
    if (!option) return;
    $('#subject').value = $('#subject').value === option.dataset.subject ? '' : option.dataset.subject;
    resetVisiblePage();
  });
  for (const kind of ['status', 'sort']) {
    $('#' + kind + 'Menu').addEventListener('click', event => {
      const option = event.target.closest('[data-action="' + kind + '-option"]');
      if (!option) return;
      $('#' + kind).value = option.dataset.value;
      $('#' + kind + 'Drop').open = false;
      resetVisiblePage();
    });
  }
  document.addEventListener('click', event => {
    document.querySelectorAll('details.dd[open]').forEach(details => {
      if (!details.contains(event.target)) details.open = false;
    });
  });

  gallery.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const id = event.target.closest('[data-id]')?.dataset.id;
    if (action === 'locate') {
      if (window.parent !== window) window.parent.postMessage({type:'archive:locate',id},location.origin);
      else window.open('../../?art='+encodeURIComponent(id),'keynlock-art-scene');
    } else if (action === 'preview') {
      showPreview(filtered.findIndex(p => p.id === id));
    } else if (action === 'heart') {
      const painting = byId.get(id);
      if (!painting || !isEligible(painting)) return;
      state.included[id] = !isOn(painting);
      save();
      repaintChangedCard(painting, $('#status').value !== 'all');
    } else if (action === 'card-option' && validIds.has(id)) {
      const name = event.target.closest('[data-category]')?.dataset.category;
      if (typeof name !== 'string') return;
      state.categories[id] = name;
      save();
      repaintChangedCard(byId.get(id), Boolean(filter.value) || $('#sort').value === 'category');
    } else if (action === 'game-card-option' && validIds.has(id)) {
      const key=event.target.closest('[data-place]')?.dataset.place;
      if(!gameWallLabels.has(key))return;
      state.placements[id]=key;save();repaintChangedCard(byId.get(id), Boolean($('#gameZone').value));
    } else if (action === 'subject-card-option' && validIds.has(id)) {
      const name = event.target.closest('[data-subject]')?.dataset.subject;
      if (![...SUBJECTS, UNKNOWN_SUBJECT].includes(name)) return;
      state.subjects[id] = name;
      save();
      repaintChangedCard(byId.get(id), Boolean($('#subject').value) || $('#sort').value === 'subject');
    }
  });
  gallery.addEventListener('toggle', event => {
    if (event.target.dataset?.cardCategory || event.target.dataset?.cardSubject || event.target.dataset?.cardGame) {
      populateCardMenu(event.target);
    }
  }, true);
  $('#excludedList').addEventListener('click', event => {
    const option = event.target.closest('[data-preview-id]');
    if (option) showPreview(filtered.findIndex(p => p.id === option.dataset.previewId));
  });
  $('#more').addEventListener('click', () => {
    showMore();
  });

  $('#close').addEventListener('click', closePreview);
  $('#modal').addEventListener('click', event => {
    if (event.target.id === 'modal') closePreview();
  });
  $('#prev').addEventListener('click', () => navigatePreview(-1));
  $('#next').addEventListener('click', () => navigatePreview(1));
  document.addEventListener('keydown', event => {
    if (!$('#modal').classList.contains('open')) return;
    if (event.key === 'Escape') closePreview();
    if (event.key === 'ArrowLeft') navigatePreview(-1);
    if (event.key === 'ArrowRight') navigatePreview(1);
  });

  $('#export').addEventListener('click', exportJson);
  $('#exportcsv').addEventListener('click', exportCsv);
  $('#import-selection').onclick=()=>$('#file').click();
  $('#file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const matched = await importSelection(file);
      alert('Восстановлено записей: ' + matched);
    } catch (error) {
      alert('Ошибка импорта: ' + error.message);
    }
    event.target.value = '';
  });
}

bindEvents();
render();
