// Автоматичні тести REST API: окрема база в пам'яті, сервер на випадковому порту.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { openDatabase } = require('../server/db');
const { createApp } = require('../server/app');

let server;
let base;

before(async () => {
  const db = openDatabase(':memory:');
  const app = createApp(db, { env: 'test', writeLimit: 1000, publicDir: path.join(__dirname, '..', 'public') });
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
};

const validReport = {
  title: 'Тестовий рапорт агента',
  agent: 'lvl7-tester',
  location: 'Лабораторія Б-510а',
  priority: 'medium',
  status: 'draft',
  incidentId: 'newyork-2012',
  body: 'Перевірка створення запису через REST API в автоматичному тесті.',
};

test('GET /api/health повертає стан і кількість записів', async () => {
  const { status, data } = await call('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.records.threats, 12);
  assert.equal(data.records.incidents, 11);
  assert.equal(data.records.dossiers, 16);
});

test('GET /api/threats підтримує пошук ?q=', async () => {
  const all = await call('GET', '/api/threats');
  assert.equal(all.data.items.length, 12);
  const found = await call('GET', '/api/threats?q=' + encodeURIComponent('танос'));
  assert.ok(found.data.items.some(t => t.id === 'thanos'));
  assert.ok(found.data.items.length < 12);
});

test('GET /api/incidents фільтрує та сортує', async () => {
  const restricted = await call('GET', '/api/incidents?status=restricted');
  assert.ok(restricted.data.items.every(x => x.status.includes('ОБМЕЖЕНО')));
  const oldest = await call('GET', '/api/incidents?sort=oldest');
  const sorts = oldest.data.items.map(x => x.sort);
  assert.deepEqual(sorts, [...sorts].sort());
});

test('GET окремого запису: 200, 404 і 400 для некоректного id', async () => {
  assert.equal((await call('GET', '/api/incidents/newyork-2012')).status, 200);
  assert.equal((await call('GET', '/api/dossiers/stark')).status, 200);
  assert.equal((await call('GET', '/api/threats/nobody')).status, 404);
  assert.equal((await call('GET', '/api/threats/' + encodeURIComponent("x' OR 1=1"))).status, 400);
});

test('CRUD рапорту: створення, читання, оновлення, видалення', async () => {
  const created = await call('POST', '/api/reports', validReport);
  assert.equal(created.status, 201);
  assert.equal(created.data.agent, 'LVL7-TESTER'); // нормалізація на сервері
  assert.equal(created.data.incidentCode, 'INC-2012-NY');
  const id = created.data.id;

  const read = await call('GET', `/api/reports/${id}`);
  assert.equal(read.data.title, validReport.title);

  const updated = await call('PUT', `/api/reports/${id}`, { ...validReport, status: 'closed' });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.status, 'closed');

  const list = await call('GET', '/api/reports?status=closed');
  assert.ok(list.data.items.some(r => r.id === id));

  assert.equal((await call('DELETE', `/api/reports/${id}`)).status, 204);
  assert.equal((await call('GET', `/api/reports/${id}`)).status, 404);
  assert.equal((await call('DELETE', `/api/reports/${id}`)).status, 404);
});

test('POST з некоректними даними повертає 400 і помилки полів', async () => {
  const { status, data } = await call('POST', '/api/reports', {
    title: 'abc', agent: 'агент', priority: 'urgent', status: 'x', incidentId: 'no-such', body: 'коротко',
  });
  assert.equal(status, 400);
  for (const name of ['title', 'agent', 'priority', 'status', 'incidentId', 'body']) {
    assert.ok(data.fields[name], `очікується помилка для поля ${name}`);
  }
});

test('Некоректний JSON → 400, невідомий маршрут API → 404', async () => {
  const res = await fetch(base + '/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(res.status, 400);
  assert.equal((await call('GET', '/api/unknown')).status, 404);
});

test('Заголовки безпеки встановлено', async () => {
  const { headers } = await call('GET', '/api/health');
  assert.match(headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-powered-by'), null);
});

test('Фото: запасна ілюстрація артефакту замість 404, стандартне зображення загрози', async () => {
  const art = await fetch(base + '/photos/tesseract.png');
  assert.equal(art.status, 200);
  assert.match(art.headers.get('content-type'), /image\/svg\+xml/);
  assert.equal((await fetch(base + '/photos/nobody.png')).status, 404);
  const { data } = await call('GET', '/api/threats/kang');
  assert.ok(['kang.svg', 'photos/kang.png', 'photos/kang.jpg', 'photos/kang.jpeg', 'photos/kang.webp'].includes(data.image));
});
