/* =====================================================================
   artifacts.js — каталог артефактів і профіль артефакту (дані з REST API)
   ===================================================================== */

function artifactCard(a) {
  return `<article class="agent-card">
    <a href="artifact_profile.html?id=${encodeURIComponent(a.id)}" class="card-link">
      <img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.name)}" class="agent-photo" width="480" height="340" loading="lazy">
      <div class="agent-info">
        <p class="badge ${escapeHtml(a.badge)}">${escapeHtml(a.status)}</p>
        <h2 class="agent-name">${escapeHtml(a.name.toUpperCase())}</h2>
        <p class="agent-desc">Тип: ${escapeHtml(a.type)} | ${escapeHtml(a.summary)}</p>
        <p class="artifact-meta">${escapeHtml(a.code)}${a.incidentCode ? ' // ІНЦИДЕНТ: ' + escapeHtml(a.incidentCode) : ''}</p>
      </div>
    </a>
  </article>`;
}

/* ---------- Каталог ---------- */
const artifactGrid = document.getElementById('artifact-grid');
if (artifactGrid) {
  const search = document.getElementById('artifact-search');
  let controller = null;
  let timer = null;

  const load = async () => {
    controller?.abort();
    controller = new AbortController();
    try {
      if (!artifactGrid.children.length) renderState(artifactGrid, 'loading', 'ЗАВАНТАЖЕННЯ АРХІВУ АРТЕФАКТІВ…');
      const { total, items } = await api.artifacts(search.value.trim(), controller.signal);
      artifactGrid.innerHTML = items.length
        ? items.map(artifactCard).join('')
        : '<p class="empty-state">ЗА ЗАПИТОМ НІЧОГО НЕ ЗНАЙДЕНО</p>';
      updateResultCount(items.length, total);
    } catch (error) {
      if (error.name === 'AbortError') return;
      renderState(artifactGrid, 'error', error.message, load);
    }
  };

  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 250);
  });
  load();
}

/* ---------- Профіль артефакту ---------- */
const artifactProfile = document.getElementById('artifact-profile');
if (artifactProfile) {
  const id = new URLSearchParams(location.search).get('id') || 'tesseract';

  const links = (items, href, cls) => items.map(x =>
    `<a class="related-link ${cls}" href="${href}${encodeURIComponent(x.id)}">[ ${escapeHtml(x.label)} ]</a>`).join('');

  const load = async () => {
    renderState(artifactProfile, 'loading', 'ЗАВАНТАЖЕННЯ ПРОФІЛЮ АРТЕФАКТУ…');
    try {
      const a = await api.artifact(id);
      document.title = `S.H.I.E.L.D. — АРТЕФАКТ: ${a.name}`;
      const incidentLinks = links(a.incidents.map(x => ({ id: x.id, label: `${x.code} — ${x.title}` })), 'incident_profile.html?id=', 'incident');
      const dossierLinks = links(a.dossiers.map(x => ({ id: x.id, label: `ДОСЬЄ: ${x.title}` })), 'dossier_profile.html?id=', 'hero');
      // history / properties / conclusion — довірені дані з початкового наповнення бази (містять <strong>, <br>).
      artifactProfile.innerHTML = `<h1 class="visually-hidden">Артефакт: ${escapeHtml(a.name)}</h1>
        <section class="left-column">
          <div class="profile-header artifact-header">
            <img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.name)}" class="profile-photo artifact-photo" width="480" height="340">
            <div class="profile-meta">
              <p class="badge ${escapeHtml(a.badge)}">${escapeHtml(a.status)}</p>
              КОД ОБ’ЄКТА: ${escapeHtml(a.code)}<br>НАЗВА: ${escapeHtml(a.name)}<br>ТИП: ${escapeHtml(a.type)}
            </div>
          </div>
          <div class="data-card">
            <h2 class="card-header-cyan">ПОХОДЖЕННЯ ТА МІСЦЕ ЗБЕРІГАННЯ</h2>
            <div class="card-text"><strong>ПОХОДЖЕННЯ:</strong> ${escapeHtml(a.origin)}<br><strong>ЗАРАЗ:</strong> ${escapeHtml(a.location)}<br><br>${escapeHtml(a.summary)}</div>
          </div>
          <div class="data-card">
            <h2 class="card-header-cyan">ХРОНОЛОГІЯ</h2>
            <div class="card-text">${a.history}</div>
          </div>
        </section>
        <section class="right-column">
          <div class="data-card">
            <h2 class="card-header-cyan">ВЛАСТИВОСТІ ТА РИЗИКИ</h2>
            <div class="card-text">${a.properties}</div>
          </div>
          <div class="data-card">
            <h2 class="card-header-cyan">ОПЕРАТИВНИЙ ВИСНОВОК Щ.И.Т.</h2>
            <div class="card-text">${a.conclusion}</div>
          </div>
          ${incidentLinks || dossierLinks ? `<div class="data-card">
            <h2 class="card-header-cyan">ПОВ’ЯЗАНІ ЗАПИСИ</h2>
            <div class="related-links artifact-related">${incidentLinks}${dossierLinks}</div>
          </div>` : ''}
        </section>`;
    } catch (error) {
      document.title = 'S.H.I.E.L.D. — АРТЕФАКТ НЕ ЗНАЙДЕНО';
      renderState(artifactProfile, 'error', error.status === 404 ? 'Артефакт не знайдено. Поверніться до каталогу.' : error.message,
        error.status === 404 ? null : load);
    }
  };
  load();
}
