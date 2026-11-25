const statusOptions = [
  { value: 'all', label: 'Все картины', icon: 'grid' },
  { value: 'on', label: 'Только для игры', icon: 'heart' },
  { value: 'off', label: 'Вне игрового отбора', icon: 'check' },
  { value: 'manual', label: 'Убраны мной', icon: 'heart' },
];
const sortOptions = [
  { value: 'rating', label: 'Рейтинг: сначала известные', icon: 'sun' },
  { value: 'rating-asc', label: 'Рейтинг: сначала редкие', icon: 'feather' },
  { value: 'title', label: 'Название А–Я', icon: 'brush' },
  { value: 'category', label: 'По категориям', icon: 'palette' },
  { value: 'subject', label: 'По сюжетам', icon: 'photo' },
  { value: 'original', label: 'Исходный порядок', icon: 'grid' },
];

// Calculate approval counts once per gallery render, not once per tile.
function gamePlanOptions(current,summary){
 const all=`<button type="button" data-action="game-filter" data-zone="" class="${current===''?'active':''}">${icon('grid')}<span>Все игровые залы</span><span class="count">${summary.approved}</span></button>`;
 return all+GAME_HALLS.map(h=>`<button type="button" data-action="game-filter" data-zone="${h.id}" class="${h.id===current?'active':''}">${icon('photo')}<span>${esc(h.title)}</span><span class="count">${summary.gameGroups.get(h.id).count}</span></button>`).join('');
}
function placementCardOptions(current){
 return GAME_HALLS.map(h=>`<div class="game-option-title">${esc(h.title)}</div>`+h.walls.map(w=>{
  const key=h.id+'/'+w[0];return `<button type="button" data-action="game-card-option" data-place="${key}" class="${current===key?'active':''}">${icon('photo')}<span>${esc(w[1])}</span></button>`;
 }).join('')).join('');
}
function refreshGame(summary){
 const groups=summary.gameGroups,current=$('#gameZone').value;
 const chosen=GAME_HALLS.find(h=>h.id===current);
 const [partHall,partWall]=current.split('/');
 const thisHall=GAME_HALLS.find(h=>h.id===partHall);
 const wallName=thisHall?.walls.find(w=>w[0]===partWall)?.[1];
 $('#gameZoneLabel').textContent=wallName?(thisHall.title+' · '+wallName):chosen?chosen.title:'Все игровые залы';
 $('#gameZoneIcon').innerHTML=icon('photo');$('#gameZoneArrow').innerHTML=icon('down');
 $('#gameZoneMenu').innerHTML=gamePlanOptions(current,summary);
 const overview=$('#gameSummary');
 overview.innerHTML=GAME_HALLS.map(h=>{
  const g=groups.get(h.id);
  return `<section class="game-hall ${current===h.id?'active':''} ${h.id==='reserve'?'game-reserve':''}">
    <button type="button" class="game-hall-header" data-action="game-chip" data-zone="${h.id}">
      <span>${esc(h.title)}</span><strong>${g.count}</strong></button>
    <div class="game-walls">${h.walls.map(w=>`<button type="button" class="game-wall ${current===h.id+'/'+w[0]?'active':''}" data-action="game-chip" data-zone="${h.id+'/'+w[0]}"><span>${esc(w[1])}</span><strong>${g.walls.get(w[0])||0}</strong></button>`).join('')}</div>
  </section>`;
 }).join('');
}
function selectionSummary() {
  const categoryCounts = new Map();
  const gameGroups=new Map(GAME_HALLS.map(h=>[h.id,{count:0,walls:new Map(h.walls.map(w=>[w[0],0]))}]));
  const museumCounts = new Map();
  const subjectCounts = new Map([...SUBJECTS, UNKNOWN_SUBJECT].map(name => [name, 0]));
  let approved = 0;
  for (const painting of data) {
    const cat = category(painting);
    if (!categoryCounts.has(cat)) categoryCounts.set(cat, 0);
    if (!isOn(painting)) continue;
    approved++;
    const z=placement(painting),gameGroup=gameGroups.get(z.hall);
    if(gameGroup){gameGroup.count++;gameGroup.walls.set(z.wall,(gameGroup.walls.get(z.wall)||0)+1)}
    categoryCounts.set(cat, categoryCounts.get(cat) + 1);
    museumCounts.set(painting.museum, (museumCounts.get(painting.museum) || 0) + 1);
    const topic = subject(painting);
    subjectCounts.set(topic, (subjectCounts.get(topic) || 0) + 1);
  }
  return { approved, categoryCounts, museumCounts, subjectCounts, gameGroups };
}

function subjectOptions(current, summary) {
  const options = [{ value: '', label: 'Все сюжеты' },
    ...[...SUBJECTS, UNKNOWN_SUBJECT].map(name => ({ value: name, label: name }))];
  return options.map(option => `
    <button type="button" data-action="subject-option" data-value="${esc(option.value)}"
      class="${option.value === current ? 'active' : ''}">
      ${icon(subjectIcon(option.value))}
      <span>${esc(option.label)}</span>
      <span class="count">${option.value ? summary.subjectCounts.get(option.value) || 0 : summary.approved}</span>
    </button>`).join('');
}

function subjectCardOptions(current, summary) {
  return [...SUBJECTS, UNKNOWN_SUBJECT].map(name => `
    <button type="button" data-action="subject-card-option" data-subject="${esc(name)}"
      class="${name === current ? 'active' : ''}">
      ${icon(subjectIcon(name))}<span>${esc(name)}</span>
      <span class="count">${summary.subjectCounts.get(name) || 0}</span>
    </button>`).join('');
}

function refreshSubjects(summary) {
  const current = $('#subject').value;
  $('#subjectLabel').textContent = current || 'Все сюжеты';
  $('#subjectIcon').innerHTML = icon(subjectIcon(current));
  $('#subjectArrow').innerHTML = icon('down');
  $('#subjectMenu').innerHTML = subjectOptions(current, summary);
  $('#subjectSummary').innerHTML = [...SUBJECTS, UNKNOWN_SUBJECT].map(name => `
    <button type="button" data-action="subject-chip" data-subject="${esc(name)}"
      class="subject-chip ${name === current ? 'active' : ''}">
      ${icon(subjectIcon(name))}<span>${esc(name)}</span>
      <span class="count">${summary.subjectCounts.get(name) || 0}</span>
    </button>`).join('');
}

function categoryOptions(current, includeAll, summary) {
  const categories = [...new Set([...categoryNames, ...summary.categoryCounts.keys()])]
    .sort((a, b) => a.localeCompare(b, 'ru'));
  const allButton = includeAll
    ? `<button type="button" data-action="filter-option" data-category="" class="${current === '' ? 'active' : ''}">
        ${icon('grid')}<span>Все категории</span><span class="count">${summary.approved}</span>
      </button>`
    : '';
  const action = includeAll ? 'filter-option' : 'card-option';
  return allButton + categories.map(name => `
    <button type="button" data-action="${action}" data-category="${esc(name)}"
      class="${name === current ? 'active' : ''}">
      ${icon(categoryIcon(name))}<span>${esc(name)}</span>
      <span class="count">${summary.categoryCounts.get(name) || 0}</span>
    </button>`).join('');
}

function refreshMuseum(summary) {
  const current = $('#museum').value;
  $('#museumLabel').textContent = current || 'Все музеи';
  $('#museumIcon').innerHTML = icon(current ? 'church' : 'grid');
  $('#museumArrow').innerHTML = icon('down');
  const options = [{ value: '', label: 'Все музеи' }, ...museums.map(m => ({ value: m, label: m }))];
  $('#museumMenu').innerHTML = options.map(option => `
    <button type="button" data-action="museum-option" data-value="${esc(option.value)}"
      class="${option.value === current ? 'active' : ''}">
      ${icon(option.value ? 'church' : 'grid')}<span>${esc(option.label)}</span>
      <span class="count">${option.value ? summary.museumCounts.get(option.value) || 0 : summary.approved}</span>
    </button>`).join('');
}

function refreshMenu(kind, options, summary) {
  const chosen = $('#' + kind).value;
  const active = options.find(option => option.value === chosen) || options[0];
  $('#' + kind + 'Label').textContent = active.label;
  $('#' + kind + 'Icon').innerHTML = icon(active.icon);
  $('#' + kind + 'Arrow').innerHTML = icon('down');
  $('#' + kind + 'Menu').innerHTML = options.map(option => {
    const amount = option.value === 'all' ? data.length
      : option.value === 'on' ? summary.approved : data.length - summary.approved;
    return `<button type="button" data-action="${kind}-option" data-value="${esc(option.value)}"
      class="${option.value === chosen ? 'active' : ''}">
      ${icon(option.icon)}<span>${esc(option.label)}</span>
      ${kind === 'status' ? `<span class="count">${amount}</span>` : ''}
    </button>`;
  }).join('');
}

function refreshFilters(summary) {
  refreshGame(summary);
  const current = filter.value;
  $('#filterLabel').textContent = current || 'Все категории';
  $('#filterIcon').innerHTML = icon(categoryIcon(current));
  $('#filterArrow').innerHTML = icon('down');
  $('#filterMenu').innerHTML = categoryOptions(current, true, summary);
  refreshSubjects(summary);
  refreshMuseum(summary);
  refreshMenu('status', statusOptions, summary);
  refreshMenu('sort', sortOptions, summary);
}

function filteredData() {
  const query = $('#search').value.toLocaleLowerCase('ru').trim();
  const status = $('#status').value;
  const chosenCategory = filter.value;
  const chosenSubject = $('#subject').value;
  const gameZone = $('#gameZone').value;
  const museum = $('#museum').value;
  const result = data.filter(painting =>
    (!query || searchIndex.get(painting.id).includes(query))
    && (!chosenCategory || category(painting) === chosenCategory)
    && (!chosenSubject || subject(painting) === chosenSubject)
    && (!gameZone || placement(painting).hall===gameZone || placementKey(painting)===gameZone)
    && (!museum || painting.museum === museum)
    && (status === 'all' || (status === 'on' && isOn(painting))
      || ((status === 'off' || status === 'manual') && !isOn(painting)))
  );
  const sort = $('#sort').value;
  if (sort === 'rating') result.sort((a, b) => b.score - a.score);
  if (sort === 'rating-asc') result.sort((a, b) => a.score - b.score);
  if (sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'category') result.sort((a, b) => category(a).localeCompare(category(b), 'ru'));
  if (sort === 'subject') result.sort((a, b) => subject(a).localeCompare(subject(b), 'ru'));
  return result;
}
