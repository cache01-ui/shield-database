/* =====================================================================
   login.js — клієнтська перевірка форми авторизації оперативника
   ---------------------------------------------------------------------
   • правила перевірки зберігаються в об’єкті validators;
   • помилки показуються під полем (aria-invalid + текст повідомлення);
   • поле перевіряється під час введення після першої спроби або втрати фокусу;
   • після 3 невдалих спроб форма блокується на 15 секунд зі зворотним відліком;
   • кнопка «ПОКАЗАТИ / СХОВАТИ» перемикає видимість ключа.
   ===================================================================== */

const form = document.getElementById('auth-form');
const fields = {
  agent: document.getElementById('agent-id'),
  key: document.getElementById('access-key'),
};
const statusBox = document.getElementById('form-status');
const submitBtn = form.querySelector('.submit-btn');

const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 15;
let failedAttempts = 0;
let lockTimer = null;

/** Правила перевірки: кожна функція повертає текст помилки або порожній рядок. */
const validators = {
  agent(value) {
    const v = value.trim();
    if (!v) return 'Вкажіть ідентифікатор агента.';
    if (/\s/.test(v)) return 'Ідентифікатор не може містити пробілів.';
    if (/[^A-Za-z0-9-]/.test(v)) return 'Дозволені лише латинські літери, цифри та дефіс.';
    if (!/^[A-Za-z0-9]{2,6}-[A-Za-z]{3,16}$/.test(v)) return 'Невірний формат. Приклад: LVL7-COULSON.';
    return '';
  },
  key(value) {
    if (!value) return 'Введіть ключ доступу.';
    if (/\s/.test(value)) return 'Ключ не може містити пробілів.';
    if (value.length < 8) return `Ключ закороткий: ${value.length} із 8 символів.`;
    if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(value) || !/\d/.test(value)) return 'Ключ має містити і літери, і цифри.';
    return '';
  },
};

/** Перевіряє одне поле й оновлює його стан на сторінці. */
function validateField(name) {
  const input = fields[name];
  const message = validators[name](input.value);
  const errorBox = document.getElementById(`${input.id}-error`);
  errorBox.textContent = message;
  input.classList.toggle('is-invalid', Boolean(message));
  input.classList.toggle('is-valid', !message);
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  return !message;
}

function setStatus(text, type) {
  statusBox.textContent = text;
  statusBox.className = `form-status${type ? ' is-' + type : ''}`;
}

/** Блокування форми після кількох невдалих спроб. */
function lockForm() {
  let left = LOCK_SECONDS;
  submitBtn.disabled = true;
  const tick = () => {
    submitBtn.textContent = `ЗАБЛОКОВАНО: ${left} с`;
    setStatus(`Забагато невдалих спроб. Повторіть через ${left} с.`, 'error');
    if (left-- <= 0) {
      clearInterval(lockTimer);
      failedAttempts = 0;
      submitBtn.disabled = false;
      submitBtn.textContent = 'ПІДТВЕРДИТИ ВХІД';
      setStatus('', '');
    }
  };
  tick();
  lockTimer = setInterval(tick, 1000);
}

// Перевірка «на льоту»: після втрати фокусу поле стає «торкнутим» і далі перевіряється під час введення.
Object.entries(fields).forEach(([name, input]) => {
  input.addEventListener('blur', () => {
    if (input.value) {
      input.dataset.touched = 'true';
      validateField(name);
    }
  });
  input.addEventListener('input', () => {
    if (input.dataset.touched) validateField(name);
  });
});

// Показати / сховати ключ доступу.
const passwordToggle = form.querySelector('.password-toggle');
passwordToggle.addEventListener('click', () => {
  const show = fields.key.type === 'password';
  fields.key.type = show ? 'text' : 'password';
  passwordToggle.textContent = show ? 'СХОВАТИ' : 'ПОКАЗАТИ';
  passwordToggle.setAttribute('aria-pressed', String(show));
  fields.key.focus();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (submitBtn.disabled) return;

  Object.values(fields).forEach(input => { input.dataset.touched = 'true'; });
  const results = Object.keys(fields).map(validateField);

  if (results.includes(false)) {
    failedAttempts++;
    const firstInvalid = Object.values(fields).find(input => input.classList.contains('is-invalid'));
    firstInvalid.focus();
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockForm();
    } else {
      const left = MAX_ATTEMPTS - failedAttempts;
      setStatus(`ДОСТУП ВІДХИЛЕНО. Виправте помилки. Залишилось спроб: ${left}.`, 'error');
    }
    return;
  }

  const agent = fields.agent.value.trim().toUpperCase();
  try { sessionStorage.setItem('shield-agent', agent); } catch { /* сховище недоступне */ }
  submitBtn.disabled = true;
  submitBtn.textContent = 'ПЕРЕВІРКА…';
  setStatus(`ДОСТУП НАДАНО. Вітаємо, агенте ${agent}. Завантаження архіву…`, 'success');
  setTimeout(() => { window.location.href = form.getAttribute('action'); }, 1200);
});
