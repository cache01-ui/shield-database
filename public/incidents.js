/* =====================================================================
   incidents.js — журнал інцидентів і профіль інциденту (дані з REST API)
   ===================================================================== */

const safeText = escapeHtml; // з api.js

/** Рівень загрози → колір і клас тегу. */
function threatTone(severity = '') {
  const s = severity.toUpperCase();
  if (/OMEGA|ОМЕГА|LEVEL 10|CRITICAL/.test(s)) return { color: '#ff3b5c', critical: true };
  if (/АЛЬФА|LEVEL 8|LEVEL 9|РІВЕНЬ 9/.test(s)) return { color: '#ffb800', critical: false };
  return { color: '#00e5ff', critical: false };
}

/** Детермінований псевдовипадковий генератор: однаковий малюнок для того самого інциденту. */
function seededRandom(seedText) {
  let seed = [...seedText].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Генерує SVG «тактичної карти» інциденту (якщо немає фото). */
function incidentArt(item, large = false) {
  if (item.image) {
    return `<img class="incident-photo${large ? ' large' : ''}" src="${safeText(item.image)}" alt="${safeText(item.title)}">`;
  }
  const { color } = threatTone(item.severity);
  const rnd = seededRandom(item.id);
  const cx = 105 + rnd() * 50, cy = 45 + rnd() * 30;  // ціль у центрі: на вузьких слотах краї обрізаються
  const blips = Array.from({ length: 6 }, () =>
    `<circle cx="${(rnd() * 260).toFixed(1)}" cy="${(rnd() * 130).toFixed(1)}" r="${(1.5 + rnd() * 2.5).toFixed(1)}" fill="${color}" fill-opacity="${(0.35 + rnd() * 0.5).toFixed(2)}"/>`).join('');
  const terrain = Array.from({ length: 3 }, (_, i) => {
    const y = 95 + i * 14;
    const pts = Array.from({ length: 9 }, (_, k) => `${k * 33},${(y - rnd() * 22).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-opacity="${0.12 + i * 0.08}" stroke-width="1.5"/>`;
  }).join('');
  const code = safeText(item.code.replace(/^INC-/, '').slice(0, 14));
  return `<svg class="incident-art${large ? ' large' : ''}" viewBox="0 0 260 130" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Тактична схема: ${safeText(item.title)}">
    <defs><radialGradient id="g-${safeText(item.id)}"><stop stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>
    <rect width="260" height="130" fill="#0b1018"/>
    <path d="M0 26H260M0 52H260M0 78H260M0 104H260M52 0V130M104 0V130M156 0V130M208 0V130" stroke="${color}" stroke-opacity=".08"/>
    ${terrain}
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="46" fill="url(#g-${safeText(item.id)})"/>
    <g fill="none" stroke="${color}" stroke-opacity=".55"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="12"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="26" stroke-dasharray="3 4"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="40" stroke-opacity=".25"/></g>
    <path d="M${(cx - 7).toFixed(1)} ${cy.toFixed(1)}h14M${cx.toFixed(1)} ${(cy - 7).toFixed(1)}v14" stroke="${color}" stroke-width="2"/>
    ${blips}
    <text x="130" y="121" text-anchor="middle" font-family="monospace" font-size="10" letter-spacing="1" fill="${color}">${code}</text>
  </svg>`;
}

function incidentRow(x) {
  const tone = threatTone(x.severity);
  const severity = x.severity.startsWith('РІВЕНЬ ЗАГРОЗИ:') ? x.severity : 'Рівень загрози: ' + x.severity;
  return `<a class="incident-row" href="incident_profile.html?id=${encodeURIComponent(x.id)}">
    ${incidentArt(x)}
    <div class="incident-summary">
      <div class="incident-heading">
        <div><span class="field-label">Код / Дата:</span><br>${safeText(x.code)} // ${safeText(x.date)}</div>
        <div><span class="field-label">Назва / Локація:</span><br>${safeText(x.title)} // ${safeText(x.location)}</div>
      </div>
      <p class="incident-description">${safeText(x.description)}</p>
      <div class="incident-badges">
        <span class="severity-tag${tone.critical ? ' critical' : ''}">${safeText(severity)}</span>
        <span class="status-tag${x.status.includes('ОБМЕЖЕНО') ? ' restricted' : ''}">Статус: [ ${safeText(x.status)} ]</span>
      </div>
    </div>
  </a>`;
}

const incidentList = document.getElementById('incident-list');
if (incidentList) {
  const filter = document.getElementById('incident-filter');
  const sort = document.getElementById('incident-sort');
  const counter = document.getElementById('incident-count');

  const draw = async () => {
    try {
      if (!incidentList.children.length) renderState(incidentList, 'loading', 'ЗАВАНТАЖЕННЯ ЖУРНАЛУ…');
      const { total, items } = await api.incidents(filter.value, sort.value);
      incidentList.innerHTML = items.length
        ? items.map(incidentRow).join('')
        : '<p class="empty-state">ЗА ОБРАНИМ ФІЛЬТРОМ ІНЦИДЕНТІВ НЕМАЄ</p>';
      if (counter) counter.textContent = `ЗАПИСІВ: ${items.length} / ${total}`;
    } catch (error) {
      renderState(incidentList, 'error', error.message, draw);
    }
  };

  filter.addEventListener('change', draw);
  sort.addEventListener('change', draw);
  draw();
}

const incidentProfile = document.getElementById('incident-profile');
if (incidentProfile) {
  const id = new URLSearchParams(location.search).get('id') || 'newyork-2012';
  const load = async () => {
  renderState(incidentProfile, 'loading', 'ЗАВАНТАЖЕННЯ ЗВІТУ ПРО ІНЦИДЕНТ…');
  let item;
  try {
    item = await api.incident(id);
  } catch (error) {
    renderState(incidentProfile, 'error', error.status === 404 ? 'Інцидент не знайдено. Поверніться до журналу.' : error.message,
      error.status === 404 ? null : load);
    return;
  }
  document.title = `S.H.I.E.L.D. — Інцидент ${item.code}`;

  const factionHtml = item.factions.map(f => `<section class="faction-card ${f.tone}"><h2>${safeText(f.title)}</h2><p>${safeText(f.summary)}</p><ul>${f.points.map(p => `<li>${safeText(p)}</li>`).join('')}</ul><p class="faction-result">${safeText(f.result)}</p></section>`).join('');
  const links = item.links.map(l => `<a class="related-link ${l.kind}" href="${safeText(l.href)}">[ ${safeText(l.label)} ]</a>`).join('');
  const artifacts = item.artifacts.length
    ? `<section class="artifact-notes"><h2>ПОВ’ЯЗАНІ АРТЕФАКТИ</h2>${item.artifacts.map(a => `<article class="artifact-note" id="artifact-${safeText(a.id)}"><h3><a href="artifact_profile.html?id=${encodeURIComponent(a.id)}">${safeText(a.title)} →</a></h3><p>${safeText(a.text)}</p></article>`).join('')}</section>`
    : '';
  const related = links || artifacts
    ? `<section class="related-section"><h2>ПОВ’ЯЗАНІ ДОСЬЄ / МАТРИЦІ / АРТЕФАКТИ</h2><div class="related-links">${links}</div>${artifacts}</section>`
    : '';

  incidentProfile.innerHTML = `<h1 class="visually-hidden">Інцидент ${safeText(item.code)}: ${safeText(item.title)}</h1>
    <div class="incident-main-grid">
      <div class="incident-primary">
        <div class="incident-overview">${incidentArt(item, true)}<div class="incident-meta">КОД ІНЦИДЕНТУ: ${safeText(item.code)}<br>ДАТА ФІКСАЦІЇ: ${safeText(item.date)}<br>ЛОКАЦІЯ: ${safeText(item.location)}<br>СТАТУС ПОДІЇ: [ ${safeText(item.status)} ]<br>РІВЕНЬ ЗАГРОЗИ: ${safeText(item.severity)}<br>МАСШТАБ БИТВИ: ${safeText(item.title)}</div></div>
        <div class="faction-grid">${factionHtml}</div>
      </div>
      <aside class="incident-aside">
        <section class="data-card"><h2 class="card-header-cyan">ПЕРЕДУМОВИ ТА МОТИВИ СТОРІН</h2><div class="card-text">${safeText(item.story)}</div></section>
        <section class="data-card key-factor"><h2 class="card-header-cyan">ОПЕРАТИВНИЙ ПІДСУМОК ТА КЛЮЧОВИЙ ФАКТОР ПЕРЕЛОМУ</h2><div class="card-text">${safeText(item.conclusion)}</div></section>
      </aside>
    </div>${related}`;
  };
  load();
}
