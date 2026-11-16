/* =====================================================================
   api.js — клієнт REST API (Fetch API + async/await)
   ---------------------------------------------------------------------
   • усі запити йдуть через одну функцію apiRequest();
   • таймаут 8 с через AbortSignal, щоб інтерфейс не «зависав»;
   • помилки сервера перетворюються на ApiError зі статусом і полями.
   ===================================================================== */

class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const timeout = AbortSignal.timeout(8000);
  const options = {
    method,
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError' && signal?.aborted) throw error; // запит скасовано новішим
    const message = error.name === 'TimeoutError'
      ? 'Сервер не відповідає. Спробуйте ще раз.'
      : 'Немає з’єднання із сервером бази даних.';
    throw new ApiError(message, 0);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || `Помилка сервера (${response.status}).`, response.status, data.fields);
  return data;
}

const api = {
  threats: (q = '', signal) => apiRequest(`/threats${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal }),
  threat: id => apiRequest(`/threats/${encodeURIComponent(id)}`),
  incidents: (status = 'all', sort = 'newest') => apiRequest(`/incidents?status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}`),
  incident: id => apiRequest(`/incidents/${encodeURIComponent(id)}`),
  dossier: id => apiRequest(`/dossiers/${encodeURIComponent(id)}`),
  reports: (params = {}, signal) => apiRequest(`/reports?${new URLSearchParams(params)}`, { signal }),
  createReport: data => apiRequest('/reports', { method: 'POST', body: data }),
  updateReport: (id, data) => apiRequest(`/reports/${id}`, { method: 'PUT', body: data }),
  deleteReport: id => apiRequest(`/reports/${id}`, { method: 'DELETE' }),
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Блок стану (завантаження / помилка) з кнопкою повтору. */
function renderState(container, type, message, retry) {
  container.innerHTML = `<div class="load-state is-${type}" role="${type === 'error' ? 'alert' : 'status'}">
    <p>${escapeHtml(message)}</p>${retry ? '<button type="button" class="retry-btn">ПОВТОРИТИ</button>' : ''}</div>`;
  if (retry) container.querySelector('.retry-btn').addEventListener('click', retry);
}
