// Shared browser state. Keep this key stable: existing picks live in localStorage.
const STORAGE_KEY = 'keynlock-painting-archive-1500-v1';
const PAGE_SIZE = 60;
const data = window.editorCatalog;
const byId = new Map(data.map(p => [p.id, p]));
const searchIndex = new Map(data.map(p => [p.id, [p.title, p.titleRu, p.artist, p.artistRu, p.museum, p.id, ...(p.atelierIds||[]), p.atelierIds?.length?'ателье atelier':''].join(' ').toLocaleLowerCase('ru')]));
const validIds = new Set(byId.keys());
const categoryNames = [...new Set(data.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'ru'));
const museums = [...new Set(data.map(p => p.museum))].sort((a, b) => a.localeCompare(b, 'ru'));
const $ = selector => document.querySelector(selector);
const gallery = $('#gallery');
const filter = $('#filter');

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialSelection;
  } catch {
    return initialSelection;
  }
})();
const state = {
  included: { ...saved.included },
  categories: { ...saved.categories },
  subjects: { ...saved.subjects },
  placements: { ...saved.placements },
};

let max = PAGE_SIZE;
let filtered = [];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function category(p) {
  return state.categories[p.id] || p.category;
}
function subject(p) {
  return state.subjects[p.id] || p.subject || UNKNOWN_SUBJECT;
}
function subjectMethod(p) {
  return state.subjects[p.id] ? 'manual' : p.subjectMethod || 'unknown';
}
const gameWallLabels = new Map(GAME_HALLS.flatMap(h=>h.walls.map(w=>[h.id+'/'+w[0],{hall:h.title, wall:w[1]}])));
function placement(p) {
  const custom=state.placements[p.id];
  if(custom&&gameWallLabels.has(custom)){
    const [hall,wall]=custom.split('/');return {hall,wall};
  }
  return p.gamePlacement;
}
function placementKey(p){const g=placement(p);return g.hall+'/'+g.wall;}
function placementLabel(p){const g=gameWallLabels.get(placementKey(p));return g?g.hall+' · '+g.wall:'В резерве';}
function isEligible(p) {
  return p.rights === 'pd_candidate';
}
function isOn(p) {
  return isEligible(p) && state.included[p.id] !== false;
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...state, selectionRevision:initialSelection.selectionRevision}));
  } catch (error) {
    console.warn('Автосохранение недоступно', error);
  }
}

// Keep separately opened editor tabs in sync with the embedded editor.
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY && event.key!==null) return;
  const next=JSON.parse(event.newValue || 'null') || initialSelection;
  for(const key of Object.keys(state)) state[key]={...next[key]};
  render();
});
