import { collectionCategories, paintingCategory } from './painting-catalog.js';

export function createPaintingCollectionUI({ paintings, onSelect }) {
  const modal = document.getElementById('collection-modal');
  const search = document.getElementById('collection-search');
  const filters = document.getElementById('collection-filters');
  const grid = document.getElementById('collection-grid');
  const count = document.getElementById('collection-results');
  const more = document.getElementById('collection-more');
  const allCount = document.querySelectorAll('.collection-total');
  const normalize = (text) => String(text || '').toLocaleLowerCase('ru').replaceAll('ё', 'е');
  let category = 'all';
  let shown = 36;
  let filtered = [];
  let focusedBeforeOpen;
  let activeId = paintings[0]?.id;

  allCount.forEach((element) => { element.textContent = String(paintings.length); });

  function renderFilters() {
    filters.replaceChildren();
    for (const [id, label] of collectionCategories) {
      const amount = id === 'all' ? paintings.length : paintings.filter((art) => paintingCategory(art) === id).length;
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
    filtered = paintings.filter((art) =>
      (category === 'all' || paintingCategory(art) === category)
      && (!query || normalize(`${art.title} ${art.artist} ${art.year}`).includes(query))
    );
    count.textContent = `НАЙДЕНО ${filtered.length} · ПОКАЗАНО ${Math.min(shown, filtered.length)}`;
    grid.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const art of filtered.slice(0, shown)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'collection-card';
      card.classList.toggle('current', art.id === activeId);
      card.setAttribute('aria-label', `Выбрать картину: ${art.title}, ${art.artist}`);
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
      card.append(image, details);
      card.addEventListener('click', () => {
        close();
        activeId = art.id;
        onSelect(paintings.indexOf(art));
      });
      fragment.appendChild(card);
    }
    if (!filtered.length) {
      const blank = document.createElement('p');
      blank.className = 'collection-empty';
      blank.textContent = 'По вашему запросу картины не найдены.';
      fragment.appendChild(blank);
    }
    grid.appendChild(fragment);
    more.hidden = filtered.length <= shown;
  }

  function open() {
    focusedBeforeOpen = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('collection-is-open');
    renderFilters();
    renderGallery();
    search.focus();
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('collection-is-open');
    focusedBeforeOpen?.focus?.();
  }

  function setActive(id) {
    activeId = id;
    if (!modal.hidden) renderGallery();
  }

  document.getElementById('collection-open').addEventListener('click', open);
  document.getElementById('collection-footer').addEventListener('click', open);
  document.getElementById('collection-close').addEventListener('click', close);
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
  return { open, close, setActive, isOpen: () => !modal.hidden };
}
