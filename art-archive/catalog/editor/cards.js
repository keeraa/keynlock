function tile(p) {
  const on = isOn(p);
  const currentCategory = category(p);
  return `
    <article class="tile ${on ? '' : 'off'}" data-id="${esc(p.id)}">
      <div class="frame">
        <img loading="lazy" decoding="async" src="${p.image}"
          data-action="preview" alt="${esc(p.title)}" title="Открыть крупно">
      </div>
      <div class="info">
        <h2 title="${esc(p.title)}">${esc(p.title)}</h2>
        <div class="artist">${esc(p.artist)}</div>
        <div class="detail">${esc(p.year)} · ${esc(p.license || 'PD')}</div>
        <div class="museum-name">${esc(p.museum)}</div>
        <div class="detail">${p.physicalSizeM ? [p.physicalSizeM.width,p.physicalSizeM.height].map(m => (m*100).toLocaleString('ru',{maximumFractionDigits:2})).join(' × ')+' см' : 'Резерв · размеры не указаны'}${p.sizeMatch === 'needs_review' ? ' · требуется сверка изображения' : ''}</div>
        <div class="scoreline">
          <div class="rating">★ ${p.score}/100 · оценка</div>
          <span class="id-tag">${esc(p.id)}</span>
        </div>
        <details class="dd card-dd" data-card-category="${esc(p.id)}">
          <summary>
            ${icon(categoryIcon(currentCategory))}
            <span>${esc(currentCategory)}</span>
            <span class="arrow">${icon('down')}</span>
          </summary>
          <div class="dd-menu"></div>
        </details>
        <details class="dd card-dd game-card-dd" data-card-game="${esc(p.id)}">
          <summary title="Игровое размещение">
            ${icon('photo')}<span class="game-card-label">${esc(placementLabel(p))}</span>
            <span class="arrow">${icon('down')}</span>
          </summary><div class="dd-menu"></div>
        </details>
        <details class="dd card-dd subject-card-dd ${subject(p) === UNKNOWN_SUBJECT ? 'needs-review' : ''}"
          data-card-subject="${esc(p.id)}">
          <summary title="Сюжет: ${esc(subject(p))}. Нажми, чтобы изменить">
            ${icon(subjectIcon(subject(p)))}
            <span class="subject-card-label">Сюжет: ${esc(subject(p))}</span>
            <span class="arrow">${icon('down')}</span>
          </summary>
          <div class="dd-menu"></div>
        </details>
        <div class="links">
          ${on && p.physicalSizeM && p.sizeMatch !== 'needs_review' && placement(p).hall !== 'reserve' ? '<button type="button" data-action="locate">Показать в зале</button>' : ''}
          <a href="${esc(p.page)}" target="_blank" rel="noopener noreferrer">Источник ↗</a>
          <a href="${esc(p.hd)}" target="_blank" rel="noopener noreferrer">HD ↗</a>
        </div>
        <button type="button" class="heart ${on ? 'active' : ''}" data-action="heart" aria-pressed="${on}">
          ${icon('heart')}
          <span>${on ? 'Нравится · в отборе' : 'Не нравится · исключено'}</span>
        </button>
      </div>
    </article>`;
}

function renderExcludedOverview() {
  const status = $('#status').value;
  const visible = status === 'off' || status === 'manual';
  $('#excludedOverview').hidden = !visible;
  $('#excludedButton').classList[status === 'off' ? 'add' : 'remove']('active');
  if (!visible) return;
  $('#excludedHeading').textContent = (status === 'manual' ? 'Убраны мной: ' : 'Вне отбора: ') + filtered.length;
  $('#excludedBreakdown').textContent = 'Нажми на название, чтобы открыть картину';
  $('#excludedList').innerHTML = filtered.map(p => `
    <button type="button" class="excluded-item" data-preview-id="${esc(p.id)}">
      <span class="id-tag">${esc(p.id)}</span>
      <span class="excluded-title"><b>${esc(p.title)}</b><small>${esc(p.artist)}</small></span>
      <span class="excluded-reason manual">Убрано мной</span>
    </button>`).join('');
}

function render() {
  filtered = filteredData();
  const summary = selectionSummary();
  $('#total').textContent = data.length;
  $('#included').textContent = summary.approved;
  $('#excluded').textContent = data.length - summary.approved;
  $('#visible').textContent = filtered.length;
  refreshFilters(summary);
  renderExcludedOverview();
  $('#result').textContent = 'Показано ' + Math.min(max, filtered.length) + ' из ' + filtered.length + ' работ';
  gallery.innerHTML = filtered.length
    ? filtered.slice(0, max).map(tile).join('')
    : '<div class="empty">Картины не найдены. Измени фильтр или поисковый запрос.</div>';
  $('#more').hidden = max >= filtered.length;
}

// A dropdown's options are built only when it opens. This avoids rendering
// hundreds of category buttons inside every one of the 60 visible cards.
function populateCardMenu(details) {
  if (!details.open) return;
  const painting = byId.get(details.dataset.cardCategory || details.dataset.cardSubject || details.dataset.cardGame);
  if (!painting) return;
  const menu = details.querySelector('.dd-menu');
  if (!menu) return;
  const summary = selectionSummary();
  menu.innerHTML = details.dataset.cardGame
    ? placementCardOptions(placementKey(painting))
    : details.dataset.cardSubject
      ? subjectCardOptions(subject(painting), summary)
      : categoryOptions(category(painting), false, summary);
}

// Fast path for a single card edit. Keep the scroll position and image decoding cache.
// Full rendering remains necessary when the active filter or sort changes membership/order.
function repaintChangedCard(p, affectsList = false) {
  if (affectsList || typeof gallery.querySelector !== 'function') {
    render();
    return;
  }
  const target = gallery.querySelector('[data-id="' + p.id + '"]');
  if (target && typeof target.outerHTML === 'string') target.outerHTML = tile(p);
  const summary = selectionSummary();
  $('#included').textContent = summary.approved;
  $('#excluded').textContent = data.length - summary.approved;
  refreshFilters(summary);
}

// Pagination appends only the new batch; existing image nodes are untouched.
function showMore() {
  const oldMax = max;
  max += PAGE_SIZE;
  if (typeof gallery.insertAdjacentHTML !== 'function') {
    render();
    return;
  }
  const fragment = filtered.slice(oldMax, max).map(tile).join('');
  if (fragment) gallery.insertAdjacentHTML('beforeend', fragment);
  $('#result').textContent = 'Показано ' + Math.min(max, filtered.length) + ' из ' + filtered.length + ' работ';
  $('#more').hidden = max >= filtered.length;
}
