/* =====================================================================
   reports.js — польові рапорти: повний CRUD через REST API
   ---------------------------------------------------------------------
   READ   GET    /api/reports?q=&status=&priority=
   CREATE POST   /api/reports
   UPDATE PUT    /api/reports/:id
   DELETE DELETE /api/reports/:id
   ===================================================================== */

const LABELS = {
  priority: { low: 'НИЗЬКИЙ', medium: 'СЕРЕДНІЙ', high: 'ВИСОКИЙ', critical: 'КРИТИЧНИЙ' },
  status: { draft: 'ЧЕРНЕТКА', active: 'АКТИВНИЙ', closed: 'ЗАКРИТИЙ' },
};

const els = {
  list: document.getElementById('report-list'),
  search: document.getElementById('report-search'),
  status: document.getElementById('report-status'),
  priority: document.getElementById('report-priority'),
  newBtn: document.getElementById('new-report'),
  dialog: document.getElementById('report-dialog'),
  form: document.getElementById('report-form'),
  title: document.getElementById('report-dialog-title'),
  submit: document.getElementById('rf-submit'),
  formStatus: document.getElementById('rf-status-box'),
  incident: document.getElementById('rf-incident'),
  bodyCount: document.getElementById('rf-body-count'),
  deleteDialog: document.getElementById('delete-dialog'),
  deleteText: document.getElementById('delete-text'),
  toast: document.getElementById('toast'),
};

const state = { reports: [], editingId: null, deletingId: null, controller: null, timer: null };

/* ---------- Допоміжні функції ---------- */
const formatDate = iso => new Date(iso).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

function toast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = `toast is-visible is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('is-visible'), 3500);
}

/* ---------- READ: список рапортів ---------- */
function reportCard(r) {
  const incident = r.incidentId
    ? `<a class="report-incident" href="incident_profile.html?id=${encodeURIComponent(r.incidentId)}">${escapeHtml(r.incidentCode)}</a>`
    : '<span class="report-incident is-empty">БЕЗ ІНЦИДЕНТУ</span>';
  const edited = r.updatedAt !== r.createdAt ? ` · змінено ${formatDate(r.updatedAt)}` : '';
  return `<article class="report-card priority-${r.priority}" data-id="${r.id}">
    <header class="report-head">
      <h2 class="report-title">${escapeHtml(r.title)}</h2>
      <div class="report-tags">
        <span class="report-tag tag-${r.priority}">${LABELS.priority[r.priority]}</span>
        <span class="report-tag tag-status-${r.status}">${LABELS.status[r.status]}</span>
      </div>
    </header>
    <p class="report-meta">RPT-${String(r.id).padStart(4, '0')} · АГЕНТ ${escapeHtml(r.agent)}${r.location ? ' · ' + escapeHtml(r.location) : ''} · ${incident}</p>
    <p class="report-body">${escapeHtml(r.body)}</p>
    <footer class="report-foot">
      <time datetime="${escapeHtml(r.createdAt)}">${formatDate(r.createdAt)}${edited}</time>
      <div class="report-actions">
        <button type="button" class="report-btn" data-action="edit">РЕДАГУВАТИ</button>
        <button type="button" class="report-btn is-danger" data-action="delete">ВИДАЛИТИ</button>
      </div>
    </footer>
  </article>`;
}

async function loadReports() {
  state.controller?.abort();
  state.controller = new AbortController();
  els.list.setAttribute('aria-busy', 'true');
  if (!els.list.children.length) renderState(els.list, 'loading', 'ЗАВАНТАЖЕННЯ РАПОРТІВ…');
  try {
    const params = {};
    if (els.search.value.trim()) params.q = els.search.value.trim();
    if (els.status.value) params.status = els.status.value;
    if (els.priority.value) params.priority = els.priority.value;
    const { total, items } = await api.reports(params, state.controller.signal);
    state.reports = items;
    els.list.innerHTML = items.length
      ? items.map(reportCard).join('')
      : '<p class="empty-state">РАПОРТІВ ЗА ЦИМИ УМОВАМИ НЕМАЄ. СТВОРІТЬ НОВИЙ.</p>';
    updateResultCount(items.length, total);
  } catch (error) {
    if (error.name === 'AbortError') return;
    renderState(els.list, 'error', error.message, loadReports);
  } finally {
    els.list.setAttribute('aria-busy', 'false');
  }
}

/* ---------- Форма створення / редагування ---------- */
const fieldNames = ['title', 'agent', 'location', 'priority', 'status', 'incidentId', 'body'];
const field = name => els.form.elements[name];

// Клієнтська перевірка дублює серверну, щоб помилки було видно ще до запиту.
const clientRules = {
  title: v => (!v ? 'Вкажіть заголовок рапорту.' : v.length < 5 ? 'Заголовок має містити від 5 до 120 символів.' : ''),
  agent: v => (!v ? 'Вкажіть ідентифікатор агента.'
    : !/^[A-Za-z0-9]{2,6}-[A-Za-z]{3,16}$/.test(v) ? 'Формат: ПРЕФІКС-ПРІЗВИЩЕ латиницею, напр. LVL7-COULSON.' : ''),
  body: v => (!v ? 'Опишіть обставини в тексті рапорту.' : v.length < 20 ? `Текст закороткий: ${v.length} із 20 символів.` : ''),
};

function showFieldErrors(errors) {
  fieldNames.forEach(name => {
    const input = field(name);
    const box = document.getElementById(`rf-${name}-error`);
    const message = errors[name] || '';
    box.textContent = message;
    input.classList.toggle('is-invalid', Boolean(message));
    if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  });
  const first = fieldNames.find(name => errors[name]);
  if (first) field(first).focus();
}

function readForm() {
  return Object.fromEntries(fieldNames.map(name => [name, field(name).value.trim()]));
}

function updateBodyCount() {
  els.bodyCount.textContent = `${field('body').value.length} / 4000`;
}

async function loadIncidentOptions() {
  try {
    const { items } = await api.incidents('all', 'newest');
    els.incident.insertAdjacentHTML('beforeend',
      items.map(x => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.code)} — ${escapeHtml(x.title.slice(0, 40))}</option>`).join(''));
  } catch {
    els.incident.disabled = true; // форма працює й без списку інцидентів
  }
}

function openForm(report = null) {
  state.editingId = report ? report.id : null;
  els.form.reset();
  showFieldErrors({});
  els.formStatus.textContent = '';
  els.title.textContent = report ? `РЕДАГУВАННЯ RPT-${String(report.id).padStart(4, '0')}` : 'НОВИЙ РАПОРТ';
  if (report) {
    fieldNames.forEach(name => { field(name).value = report[name] ?? ''; });
  } else {
    field('agent').value = UI.agent || '';
  }
  updateBodyCount();
  els.dialog.showModal();
  field('title').focus();
}

async function submitForm(event) {
  event.preventDefault();
  const data = readForm();
  const errors = {};
  for (const [name, rule] of Object.entries(clientRules)) {
    const message = rule(data[name]);
    if (message) errors[name] = message;
  }
  showFieldErrors(errors);
  if (Object.keys(errors).length) {
    els.formStatus.textContent = 'Виправте позначені поля.';
    els.formStatus.className = 'form-status is-error';
    return;
  }

  els.submit.disabled = true;
  els.submit.textContent = 'ЗБЕРЕЖЕННЯ…';
  try {
    const saved = state.editingId
      ? await api.updateReport(state.editingId, data)
      : await api.createReport(data);
    els.dialog.close();
    toast(state.editingId ? `Рапорт RPT-${String(saved.id).padStart(4, '0')} оновлено.` : `Рапорт RPT-${String(saved.id).padStart(4, '0')} створено.`);
    await loadReports();
  } catch (error) {
    // Помилки валідації з сервера показуємо біля відповідних полів.
    if (error.status === 400 && error.fields) showFieldErrors(error.fields);
    els.formStatus.textContent = error.message;
    els.formStatus.className = 'form-status is-error';
  } finally {
    els.submit.disabled = false;
    els.submit.textContent = 'ЗБЕРЕГТИ';
  }
}

/* ---------- DELETE ---------- */
function askDelete(report) {
  state.deletingId = report.id;
  els.deleteText.textContent = `Рапорт «${report.title}» буде видалено з бази без можливості відновлення.`;
  els.deleteDialog.showModal();
  document.getElementById('delete-cancel').focus();
}

async function confirmDelete() {
  const id = state.deletingId;
  const okBtn = document.getElementById('delete-ok');
  okBtn.disabled = true;
  try {
    await api.deleteReport(id);
    els.deleteDialog.close();
    toast(`Рапорт RPT-${String(id).padStart(4, '0')} видалено.`);
    await loadReports();
  } catch (error) {
    els.deleteDialog.close();
    toast(error.message, 'error');
  } finally {
    okBtn.disabled = false;
  }
}

/* ---------- Обробники подій ---------- */
// Делегування: один обробник на весь список обслуговує кнопки всіх карток, навіть доданих пізніше.
els.list.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = Number(button.closest('.report-card').dataset.id);
  const report = state.reports.find(r => r.id === id);
  if (!report) return;
  if (button.dataset.action === 'edit') openForm(report);
  if (button.dataset.action === 'delete') askDelete(report);
});

els.search.addEventListener('input', () => {
  clearTimeout(state.timer);
  state.timer = setTimeout(loadReports, 250);
});
els.status.addEventListener('change', loadReports);
els.priority.addEventListener('change', loadReports);
els.newBtn.addEventListener('click', () => openForm());
els.form.addEventListener('submit', submitForm);
field('body').addEventListener('input', updateBodyCount);
document.getElementById('rf-cancel').addEventListener('click', () => els.dialog.close());
document.getElementById('delete-cancel').addEventListener('click', () => els.deleteDialog.close());
document.getElementById('delete-ok').addEventListener('click', confirmDelete);

loadIncidentOptions();
loadReports();
