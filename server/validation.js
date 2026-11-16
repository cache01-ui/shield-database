// Серверна перевірка вхідних даних. Клієнтській перевірці не довіряємо:
// запит до API можна надіслати в обхід форми (curl, Postman, консоль браузера).

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['draft', 'active', 'closed'];
const AGENT_RE = /^[A-Za-z0-9]{2,6}-[A-Za-z]{3,16}$/;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;

/** Обрізає пробіли та прибирає керувальні символи (крім переносу рядка). */
const clean = value => (typeof value === 'string' ? value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim() : '');

/**
 * Перевіряє тіло запиту рапорту.
 * @returns {{ value: object, errors: Record<string, string> }}
 */
function validateReport(input, { incidentExists }) {
  const body = input && typeof input === 'object' ? input : {};
  const errors = {};
  const value = {
    title: clean(body.title),
    agent: clean(body.agent).toUpperCase(),
    location: clean(body.location),
    priority: clean(body.priority),
    status: clean(body.status),
    incidentId: clean(body.incidentId) || null,
    body: clean(body.body),
  };

  if (!value.title) errors.title = 'Вкажіть заголовок рапорту.';
  else if (value.title.length < 5 || value.title.length > 120) errors.title = 'Заголовок має містити від 5 до 120 символів.';

  if (!value.agent) errors.agent = 'Вкажіть ідентифікатор агента.';
  else if (!AGENT_RE.test(value.agent)) errors.agent = 'Формат ідентифікатора: ПРЕФІКС-ПРІЗВИЩЕ латиницею, напр. LVL7-COULSON.';

  if (value.location.length > 120) errors.location = 'Локація — не більше 120 символів.';

  if (!PRIORITIES.includes(value.priority)) errors.priority = 'Оберіть пріоритет зі списку.';
  if (!STATUSES.includes(value.status)) errors.status = 'Оберіть статус зі списку.';

  if (value.incidentId && (!SLUG_RE.test(value.incidentId) || !incidentExists(value.incidentId))) {
    errors.incidentId = 'Такого інциденту в базі немає.';
  }

  if (!value.body) errors.body = 'Опишіть обставини в тексті рапорту.';
  else if (value.body.length < 20) errors.body = `Текст закороткий: ${value.body.length} із 20 символів.`;
  else if (value.body.length > 4000) errors.body = 'Текст рапорту — не більше 4000 символів.';

  return { value, errors };
}

module.exports = { validateReport, PRIORITIES, STATUSES, SLUG_RE, clean };
