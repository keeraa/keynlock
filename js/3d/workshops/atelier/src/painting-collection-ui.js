import { collectionCategories, paintingCategory } from './painting-catalog.js';
import { getPaintingLore, getPaintingLoreLabels } from './lore/painting-lore.js';

export function createPaintingCollectionUI({ paintings, onSelect, $, root, isRestored = () => false,
  getWallIds = () => [], onToggleWall = () => {}, onOpenChange = (open) => {} }) {
  const modal = $('collection-modal');
  const search = $('collection-search');
  const filters = $('collection-filters');
  const grid = $('collection-grid');
  const count = $('collection-results');
  const more = $('collection-more');
  const allCount = root.querySelectorAll('.collection-total');
  const loreLabels = getPaintingLoreLabels();
  const normalize = (text) => String(text || '').toLocaleLowerCase('ru').replaceAll('ё', 'е');
  let category = 'all';
  let mode = 'all';
  let shown = 36;
  let filtered = [];
  let focusedBeforeOpen;
  let activeId = paintings[0]?.id;

  allCount.forEach((element) => { element.textContent = String(paintings.length); });
  $('collection-policy-department').textContent = loreLabels.policyDepartment;
  $('collection-policy-motto').textContent = loreLabels.policy;
  $('collection-policy-explanation').textContent = loreLabels.policyExplanation;

  function candidates() {
    return mode === 'wall' ? paintings.filter((art) => isRestored(art.id)) : paintings;
  }

  function renderMode() {
    const selected = new Set(getWallIds());
    $('collection-wall-count').textContent = `${selected.size}/30`;
    for (const [id, tab] of [['all', 'collection-tab-all'], ['wall', 'collection-tab-wall']]) {
      const button = $(tab);
      button.classList.toggle('active', mode === id);
      button.setAttribute('aria-pressed', String(mode === id));
    }
    $('collection-description').textContent = mode === 'wall'
      ? `Готовые картины: ${candidates().length}. Выберите до 30 работ для стены над мольбертами.`
      : 'Произведения из собрания Keynlock. Выберите полотно для реставрации.';
  }

  function setMode(next) {
    mode = next === 'wall' ? 'wall' : 'all';
    category = 'all';
    shown = 36;
    renderMode();
    renderFilters();
    renderGallery();
  }

  function renderFilters() {
    filters.replaceChildren();
    const available = candidates();
    for (const [id, label] of collectionCategories) {
      const amount = id === 'all' ? available.length : available.filter((art) => paintingCategory(art) === id).length;
      if (!amount) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'collection-filter';
      button.classList.toggle('active', category === id);
      button.setAttribute('aria-pressed', String(category === id));
      button.textContent = `${label} · ${amount}`;
      button.addEventListener('click', () => {
        category = id;
        shown = 36;
        renderFilters();
        renderGallery();
      });
      filters.appendChild(button);
    }
  }

  function renderGallery() {
    const query = normalize(search.value.trim());
    filtered = candidates().filter((art) =>
      (category === 'all' || paintingCategory(art) === category)
      && (!query || normalize(`${art.title} ${art.artist} ${art.year}`).includes(query))
    );
    count.textContent = `${mode === 'wall' ? 'ГОТОВЫЕ РАБОТЫ' : 'НАЙДЕНО'} ${filtered.length} · ПОКАЗАНО ${Math.min(shown, filtered.length)}`;
    grid.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const art of filtered.slice(0, shown)) {
      const card = document.createElement(mode === 'wall' ? 'article' : 'button');
      if (mode !== 'wall') card.type = 'button';
      card.className = 'collection-card';
      card.classList.toggle('current', art.id === activeId);
      if (mode !== 'wall') card.setAttribute('aria-label', `Выбрать картину: ${art.title}, ${art.artist}`);
      const image = document.createElement('img');
      image.src = art.image;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.alt = '';
      image.addEventListener('error', () => card.classList.add('missing-image'), { once: true });
      const title = document.createElement('strong');
      title.textContent = art.title;
      const artist = document.createElement('span');
      artist.textContent = `${art.artist} · ${art.year}`;
      const details = document.createElement('div');
      details.append(title, artist);
      const lore = getPaintingLore(art.id);
      if (lore) {
        const description = document.createElement('p');
        description.className = 'collection-card-description';
        description.textContent = lore.description;
        const banLabel = document.createElement('span');
        banLabel.className = 'collection-card-ban-label';
        banLabel.textContent = loreLabels.banned;
        const banReason = document.createElement('p');
        banReason.className = 'collection-card-ban-reason';
        banReason.textContent = lore.banReason;
        details.append(description, banLabel, banReason);
      }
      if (mode === 'all' && isRestored(art.id)) {
        const status = document.createElement('span');
        status.className = 'collection-restored';
        status.textContent = '✦ РЕСТАВРАЦИЯ ЗАВЕРШЕНА';
        details.appendChild(status);
      }
      card.append(image, details);
      if (mode === 'wall') {
        const selected = getWallIds().includes(art.id);
        const action = document.createElement('button');
        action.type = 'button';
        action.className = `collection-wall-action${selected ? ' on-wall' : ''}`;
        action.setAttribute('aria-pressed', String(selected));
        action.textContent = selected ? '✓ НА СТЕНЕ · СНЯТЬ' : '+ ПОВЕСИТЬ НА СТЕНУ';
        action.addEventListener('click', () => {
          onToggleWall(art.id);
          renderMode();
          renderGallery();
        });
        card.appendChild(action);
      } else {
        card.addEventListener('click', () => {
          close();
          activeId = art.id;
          onSelect(paintings.indexOf(art));
        });
      }
      fragment.appendChild(card);
    }
    if (!filtered.length) {
      const blank = document.createElement('p');
      blank.className = 'collection-empty';
      blank.textContent = mode === 'wall' && !candidates().length
        ? 'Пока нет завершённых работ. Очистите полотно и восстановите его цвет — после этого картину можно повесить на стену.'
        : 'По вашему запросу картины не найдены.';
      fragment.appendChild(blank);
    }
    grid.appendChild(fragment);
    more.hidden = filtered.length <= shown;
  }

  function open(initialMode = 'all') {
    focusedBeforeOpen = document.activeElement;
    modal.hidden = false;
    onOpenChange(true);
    if (root === document) document.body.classList.add('collection-is-open');
    setMode(initialMode);
    search.focus();
  }

  function close() {
    modal.hidden = true;
    onOpenChange(false);
    if (root === document) document.body.classList.remove('collection-is-open');
    focusedBeforeOpen?.focus?.();
  }

  function setActive(id) {
    activeId = id;
    if (!modal.hidden) renderGallery();
  }

  function refresh() {
    if (modal.hidden) return;
    renderMode();
    renderFilters();
    renderGallery();
  }

  $('collection-open').addEventListener('click', () => open('all'));
  $('collection-footer').addEventListener('click', () => open('all'));
  $('collection-tab-all').addEventListener('click', () => setMode('all'));
  $('collection-tab-wall').addEventListener('click', () => setMode('wall'));
  $('collection-close').addEventListener('click', close);
  modal.querySelector('.collection-shade').addEventListener('click', close);
  search.addEventListener('input', () => { shown = 36; renderGallery(); });
  more.addEventListener('click', () => { shown += 36; renderGallery(); });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const elements = [...modal.querySelectorAll('button:not([hidden]), input:not([hidden])')]
      .filter((node) => node.offsetParent !== null);
    if (!elements.length) return;
    if (event.shiftKey && document.activeElement === elements[0]) {
      event.preventDefault();
      elements[elements.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) {
      event.preventDefault();
      elements[0].focus();
    }
  });
  return { open, close, setActive, refresh, isOpen: () => !modal.hidden };
}
