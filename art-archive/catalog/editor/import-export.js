const CSV_FIELDS = [
  'id', 'title', 'artist', 'year', 'museum', 'category', 'included',
  'image', 'source', 'date_source', 'license', 'license_source', 'rights_status',
  'subject', 'subject_method', 'game_hall','game_wall', 'collection', 'censorship_status',
];

function exportSelection() {
  const selected = data.filter(isOn);
  return {
    version: 3,
    selection_revision: initialSelection.selectionRevision,
    project: 'Keynlock Art Archive',
    exported_at: new Date().toISOString(),
    total: data.length,
    selected: selected.length,
    rights_review_ids: [],
    excluded_ids: data.filter(p => !isOn(p)).map(p => p.id),
    placement_overrides: Object.fromEntries(Object.entries(state.placements).filter(([id,key])=>validIds.has(id)&&gameWallLabels.has(key))),
    category_overrides: Object.fromEntries(
      Object.entries(state.categories).filter(([id]) => validIds.has(id))
    ),
    subject_overrides: Object.fromEntries(
      Object.entries(state.subjects).filter(([id, name]) =>
        validIds.has(id) && [...SUBJECTS, UNKNOWN_SUBJECT].includes(name))
    ),
    paintings: selected.map(p => ({
      id: p.id,
      title: p.title,
      artist: p.artist,
      year: p.year,
      museum: p.museum,
      category: category(p),
      subject: subject(p),
      subject_method: subjectMethod(p),
      included: true,
      game_hall: placement(p).hall,
      game_wall: placement(p).wall,
      image: p.hd,
      source: p.page,
      date_source: p.dateSource,
      license: p.license,
      license_source: p.licenseSource,
      rights_status: p.rights,
      collection: p.collection || '',
      censorship_status: p.censorship?.status || '',
    })),
  };
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function exportJson() {
  download('keynlock-art-selection.json', JSON.stringify(exportSelection(), null, 2), 'application/json');
}

function exportCsv() {
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const lines = [
    CSV_FIELDS.map(quote).join(','),
    ...exportSelection().paintings.map(p => CSV_FIELDS.map(key => quote(p[key])).join(',')),
  ];
  download('keynlock-art-selection.csv', '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
}

async function importSelection(file) {
  const payload = JSON.parse(await file.text());
  if (!Array.isArray(payload.paintings) && Array.isArray(payload.selected_ids)) {
    payload.paintings=payload.selected_ids.map(id=>({id,included:true}));
  }
  if (!Array.isArray(payload.paintings)) throw new Error('Нет массива paintings');

  const listed = payload.paintings.filter(p => p && validIds.has(p.id));
  if (payload.paintings.length && !listed.length) throw new Error('Нет совпадающих ID');
  const selected = new Set(listed.filter(p=>p.included!==false).map(p=>p.id));
  state.included = Object.fromEntries(data.filter(p=>!selected.has(p.id)).map(p=>[p.id,false]));
  state.categories = {}; state.subjects = {}; state.placements = {};
  let matched = 0;
  for (const painting of listed) {
    matched++;
    if (typeof painting.included === 'boolean') state.included[painting.id] = painting.included;
    if(typeof painting.game_hall==='string'&&typeof painting.game_wall==='string'){
      const original=painting.game_hall+'/'+painting.game_wall;
      const key=migrateExhibitionDestination(original,painting.id,payload.selection_revision??0);
      if(gameWallLabels.has(key))state.placements[painting.id]=key;
    }
    if (typeof painting.category === 'string' && painting.category.trim()) {
      state.categories[painting.id] = painting.category;
    }
    if (typeof painting.subject === 'string'
      && [...SUBJECTS, UNKNOWN_SUBJECT].includes(painting.subject)
      && (painting.subject_method === 'manual' || !payload.subject_overrides)) {
      state.subjects[painting.id] = painting.subject;
    }
  }
  for(const [id,original] of Object.entries(payload.placement_overrides || {})){
    const key=migrateExhibitionDestination(original,id,payload.selection_revision??0);
    if(validIds.has(id) && gameWallLabels.has(key)) state.placements[id]=key;
  }
  for(const [id,value] of Object.entries(payload.category_overrides || {}))
    if(validIds.has(id) && typeof value==='string') state.categories[id]=value;
  for(const [id,value] of Object.entries(payload.subject_overrides || {}))
    if(validIds.has(id) && typeof value==='string') state.subjects[id]=value;
  save();
  max = PAGE_SIZE;
  render();
  return matched;
}
