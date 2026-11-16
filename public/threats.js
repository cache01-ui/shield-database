/* =====================================================================
   threats.js — матриця загроз і профіль загрози (дані з REST API)
   ===================================================================== */

function threatCard(item) {
  return `<a class="threat-card" href="threat_profile.html?id=${encodeURIComponent(item.id)}">
    <img class="threat-photo" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" width="480" height="340">
    <div class="threat-info">
      <span class="threat-badge ${escapeHtml(item.badge)}">${escapeHtml(item.status)}</span>
      <h2>${escapeHtml(item.name)}</h2>
      <p class="threat-callsign">Позивний: ${escapeHtml(item.callsign)} // ${escapeHtml(item.threat)}</p>
      <p class="threat-summary">${escapeHtml(item.summary)}</p>
    </div>
  </a>`;
}

/* ---------- Каталог: пошук на сервері із затримкою та скасуванням застарілих запитів ---------- */
const grid = document.getElementById('threat-grid');
if (grid) {
  const search = document.getElementById('threat-search');
  let controller = null;
  let timer = null;

  const load = async () => {
    controller?.abort();                 // скасовуємо попередній незавершений запит
    controller = new AbortController();
    try {
      if (!grid.children.length) renderState(grid, 'loading', 'ЗАВАНТАЖЕННЯ МАТРИЦІ ЗАГРОЗ…');
      const { total, items } = await api.threats(search.value.trim(), controller.signal);
      grid.innerHTML = items.length ? items.map(threatCard).join('') : '<p class="empty-state">ЗА ЗАПИТОМ НІЧОГО НЕ ЗНАЙДЕНО</p>';
      updateResultCount(items.length, total);
    } catch (error) {
      if (error.name === 'AbortError') return;
      renderState(grid, 'error', error.message, load);
    }
  };

  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 250);       // debounce: не надсилаємо запит на кожну літеру
  });
  load();
}

// Запасне зображення без inline-атрибута onerror: подія error не спливає,
// тому перехоплюємо її на фазі занурення (capture) одним обробником на документ.
document.addEventListener('error', event => {
  const img = event.target;
  if (img instanceof HTMLImageElement && !img.dataset.fallback && (img.closest('.threat-card') || img.closest('.threat-profile'))) {
    img.dataset.fallback = 'true';
    img.src = 'threat-placeholder.svg';
  }
}, true);

/* ---------- Профіль загрози ---------- */
const profile = document.getElementById('threat-profile');
if (profile) {
  const id = new URLSearchParams(location.search).get('id') || 'thanos';

  const load = async () => {
    renderState(profile, 'loading', 'ЗАВАНТАЖЕННЯ ПРОФІЛЮ…');
    try {
      const item = await api.threat(id);
      document.title = `S.H.I.E.L.D. — ЗАГРОЗА: ${item.name}`;
      // bio / equipment / conclusion — довірені дані з початкового наповнення бази (містять <strong>, <br>).
      profile.innerHTML = `<h1 class="visually-hidden">Профіль загрози: ${escapeHtml(item.name)}</h1>
        <section class="left-column">
          <div class="profile-header">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="profile-photo" width="154" height="200">
            <div class="profile-meta">КОД ОБ’ЄКТА: ${escapeHtml(item.code)}<br>ПОВНЕ ІМ’Я: ${escapeHtml(item.fullname)}<br>ПОЗИВНИЙ: ${escapeHtml(item.callsign)}<br>РІВЕНЬ ЗАГРОЗИ: ${escapeHtml(item.threat)}<br>ПРИНАЛЕЖНІСТЬ: ${escapeHtml(item.affiliation)}</div>
          </div>
          <div class="data-card"><h2 class="card-header-cyan">БІОМЕТРИЧНІ ДАНІ ТА ЗВ’ЯЗКИ</h2><div class="card-text">${item.bio}</div></div>
        </section>
        <section class="right-column">
          <div class="data-card"><h2 class="card-header-cyan">ТЕХНІЧНА СПЕЦИФІКАЦІЯ ТА ОЗБРОЄННЯ</h2><div class="card-text">${item.equipment}</div></div>
          <div class="data-card"><h2 class="card-header-cyan">ОПЕРАТИВНИЙ ВИСНОВОК Щ.И.Т.</h2><div class="card-text">${item.conclusion}</div></div>
        </section>`;
    } catch (error) {
      document.title = 'S.H.I.E.L.D. — ДОСЬЄ НЕ ЗНАЙДЕНО';
      renderState(profile, 'error', error.status === 404 ? 'Профіль не знайдено. Поверніться до матриці загроз.' : error.message,
        error.status === 404 ? null : load);
    }
  };
  load();
}
