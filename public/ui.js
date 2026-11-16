/* =====================================================================
   ui.js — спільні інтерактивні компоненти внутрішніх сторінок бази даних
   ---------------------------------------------------------------------
   1. Бейдж агента в шапці (дані сесії з sessionStorage)
   2. Мобільне меню навігації (кнопка «☰ МЕНЮ»)
   3. Діалог підтвердження виходу із сесії
   4. Кнопка «Нагору»
   5. Перемикач вигляду каталогу «Сітка / Список» (делегування подій)
   6. Гарячі клавіші: «/» — пошук, Esc — очищення пошуку
   ===================================================================== */

// Безпечна робота зі сховищем: у приватному режимі воно може бути недоступне.
const storage = {
  get(area, key) {
    try { return window[area].getItem(key); } catch { return null; }
  },
  set(area, key, value) {
    try { window[area].setItem(key, value); } catch { /* сховище недоступне */ }
  },
  remove(area, key) {
    try { window[area].removeItem(key); } catch { /* сховище недоступне */ }
  },
};

const UI = {
  agent: storage.get('sessionStorage', 'shield-agent'),

  init() {
    document.documentElement.classList.add('js');
    this.renderAgentBadge();
    this.initMobileMenu();
    this.initLogoutDialog();
    this.initBackToTop();
    this.initViewToggle();
    this.initHotkeys();
  },

  /* ---------- 1. Бейдж агента ---------- */
  renderAgentBadge() {
    const header = document.querySelector('.top-nav');
    if (!header) return;
    const badge = document.createElement('p');
    badge.className = 'agent-badge';
    badge.textContent = `АГЕНТ: ${this.agent || 'ГІСТЬ'}`;
    if (!this.agent) badge.classList.add('is-guest');
    header.querySelector('.system-title')?.after(badge);
  },

  /* ---------- 2. Мобільне меню ---------- */
  initMobileMenu() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;

    const setOpen = open => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '✕ ЗАКРИТИ' : '☰ МЕНЮ';
    };

    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    // Делегування: один обробник на все меню закриває його після вибору розділу.
    nav.addEventListener('click', event => {
      if (event.target.closest('.tab-link')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', event => {
      if (nav.classList.contains('is-open') && !event.target.closest('.top-nav')) setOpen(false);
    });
  },

  /* ---------- 3. Діалог виходу ---------- */
  initLogoutDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('aria-labelledby', 'logout-title');
    dialog.innerHTML = `
      <h2 id="logout-title">ЗАВЕРШИТИ СЕСІЮ?</h2>
      <p class="confirm-text"></p>
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel">СКАСУВАТИ</button>
        <button type="button" class="confirm-ok">ВИЙТИ</button>
      </div>`;
    document.body.append(dialog);
    let target = 'index.html';

    // Делегування на рівні документа: працює для будь-якої кнопки виходу на сторінці.
    document.addEventListener('click', event => {
      const link = event.target.closest('.logout-btn');
      if (!link || typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      target = link.getAttribute('href');
      dialog.querySelector('.confirm-text').textContent =
        `Агента ${this.agent || 'ГІСТЬ'} буде від’єднано від бази даних. Незбережені фільтри буде скинуто.`;
      dialog.showModal();
      dialog.querySelector('.confirm-cancel').focus();
    });

    dialog.addEventListener('click', event => {
      if (event.target.closest('.confirm-cancel') || event.target === dialog) dialog.close();
      if (event.target.closest('.confirm-ok')) {
        storage.remove('sessionStorage', 'shield-agent');
        window.location.href = target;
      }
    });
  },

  /* ---------- 4. Кнопка «Нагору» ---------- */
  initBackToTop() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-to-top';
    button.setAttribute('aria-label', 'Повернутися на початок сторінки');
    button.textContent = '▲ НАГОРУ';
    document.body.append(button);

    const update = () => button.classList.toggle('is-visible', window.scrollY > 500);
    window.addEventListener('scroll', update, { passive: true });
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  },

  /* ---------- 5. Перемикач «Сітка / Список» ---------- */
  initViewToggle() {
    const group = document.querySelector('.view-toggle');
    const grid = document.querySelector('.cards-row');
    if (!group || !grid) return;
    const key = `shield-view:${location.pathname.split('/').pop()}`;

    const apply = view => {
      grid.classList.toggle('is-list', view === 'list');
      group.querySelectorAll('[data-view]').forEach(btn =>
        btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    };

    // Делегування: один обробник на групу замість обробника на кожну кнопку.
    group.addEventListener('click', event => {
      const btn = event.target.closest('[data-view]');
      if (!btn) return;
      apply(btn.dataset.view);
      storage.set('localStorage', key, btn.dataset.view);
    });
    apply(storage.get('localStorage', key) || 'grid');
  },

  /* ---------- 6. Гарячі клавіші ---------- */
  initHotkeys() {
    const search = document.querySelector('.search-input');
    if (!search) return;
    document.addEventListener('keydown', event => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, select');
      if (event.key === '/' && !typing) {
        event.preventDefault();
        search.focus();
      }
    });
    search.addEventListener('keydown', event => {
      if (event.key === 'Escape' && search.value) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  },
};

/** Оновлює лічильник результатів пошуку в каталогах. */
function updateResultCount(visible, total) {
  const counter = document.getElementById('result-count');
  if (counter) counter.textContent = `ЗНАЙДЕНО: ${visible} / ${total}`;
}

UI.init();
