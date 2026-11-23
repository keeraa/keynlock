let current = -1;

function showPreview(index) {
  if (index < 0 || index >= filtered.length) return;
  current = index;
  const painting = filtered[index];
  const big = $('#big');
  big.src = painting.image;
  const detail = new Image();
  detail.onload = () => {
    if (filtered[current] === painting && $('#modal').classList.contains('open')) big.src = detail.src;
  };
  if (painting.detail || painting.hd) detail.src = painting.detail || painting.hd;
  $('#boriginal').href = painting.hd || painting.detail || painting.image;
  $('#big').alt = painting.title;
  $('#btitle').textContent = painting.title;
  $('#bartist').textContent = painting.artist;
  $('#byear').textContent = painting.year;
  $('#bmuseum').textContent = 'Музей: ' + painting.museum;
  $('#bcategory').textContent = 'Зал: ' + category(painting);
  $('#bplacement').textContent = 'Игровое размещение: '+placementLabel(painting);
  $('#bsubject').textContent = 'Сюжет: ' + subject(painting)
    + (subjectMethod(painting) === 'title' ? ' · предварительно' : '');
  $('#brights').textContent = '✓ Кандидат для игры: ' + painting.license;
  $('#brights').className = 'rights-small';
  $('#bigscore').textContent = '★ ' + painting.score + '/100 · оценка';
  $('#bsource').href = painting.page;
  $('#modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  $('#modal').classList.remove('open');
  $('#big').removeAttribute('src');
  document.body.style.overflow = '';
  current = -1;
}

function navigatePreview(offset) {
  if (!filtered.length) return;
  showPreview((current + offset + filtered.length) % filtered.length);
}
