// Маршрути REST API. Усі запити до бази — параметризовані (захист від SQL-ін'єкцій).
const express = require('express');
const { validateReport, PRIORITIES, STATUSES, SLUG_RE, clean } = require('./validation');

/** Обгортка обробників: будь-яка помилка передається в загальний обробник помилок. */
const handle = fn => (req, res, next) => {
  try { fn(req, res, next); } catch (error) { next(error); }
};

const parseJson = text => { try { return JSON.parse(text); } catch { return []; } };

function createApiRouter(db) {
  const router = express.Router();

  const sql = {
    dossierList: db.prepare('SELECT id, title FROM dossiers ORDER BY id'),
    dossierById: db.prepare('SELECT id, title, html FROM dossiers WHERE id = ?'),
    threatList: db.prepare(`SELECT id, code, name, callsign, status, badge, threat, role, image, keywords, summary
                            FROM threats ORDER BY position`),
    threatById: db.prepare('SELECT * FROM threats WHERE id = ?'),
    incidentList: db.prepare(`SELECT id, code, date, sort_key AS sort, title, location, severity, status, description, image
                              FROM incidents`),
    incidentById: db.prepare('SELECT * FROM incidents WHERE id = ?'),
    incidentExists: db.prepare('SELECT 1 FROM incidents WHERE id = ?'),
    reportById: db.prepare(`SELECT r.id, r.title, r.agent, r.location, r.priority, r.status, r.incident_id AS incidentId,
                              i.code AS incidentCode, r.body, r.created_at AS createdAt, r.updated_at AS updatedAt
                            FROM reports r LEFT JOIN incidents i ON i.id = r.incident_id WHERE r.id = ?`),
    reportInsert: db.prepare(`INSERT INTO reports (title, agent, location, priority, status, incident_id, body)
                              VALUES (?, ?, ?, ?, ?, ?, ?)`),
    reportUpdate: db.prepare(`UPDATE reports SET title = ?, agent = ?, location = ?, priority = ?, status = ?,
                              incident_id = ?, body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`),
    reportDelete: db.prepare('DELETE FROM reports WHERE id = ?'),
    counts: db.prepare(`SELECT (SELECT COUNT(*) FROM dossiers) AS dossiers, (SELECT COUNT(*) FROM threats) AS threats,
                               (SELECT COUNT(*) FROM incidents) AS incidents, (SELECT COUNT(*) FROM reports) AS reports`),
  };
  const incidentExists = id => Boolean(sql.incidentExists.get(id));

  const notFound = (res, what) => res.status(404).json({ error: `${what} не знайдено.` });
  const slugParam = (req, res) => {
    if (!SLUG_RE.test(req.params.id)) { res.status(400).json({ error: 'Некоректний ідентифікатор.' }); return null; }
    return req.params.id;
  };
  const reportIdParam = (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: 'Некоректний номер рапорту.' }); return null; }
    return id;
  };

  /* ---------- Службовий маршрут ---------- */
  router.get('/health', handle((req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), records: sql.counts.get() });
  }));

  /* ---------- Досьє (лише читання) ---------- */
  router.get('/dossiers', handle((req, res) => res.json(sql.dossierList.all())));
  router.get('/dossiers/:id', handle((req, res) => {
    const id = slugParam(req, res); if (!id) return;
    const row = sql.dossierById.get(id);
    return row ? res.json(row) : notFound(res, 'Досьє');
  }));

  /* ---------- Загрози (лише читання, пошук ?q=) ---------- */
  router.get('/threats', handle((req, res) => {
    const q = clean(req.query.q).toLocaleLowerCase('uk').slice(0, 80);
    let rows = sql.threatList.all();
    if (q) rows = rows.filter(t => `${t.name} ${t.callsign} ${t.role} ${t.summary} ${t.keywords}`.toLocaleLowerCase('uk').includes(q));
    res.json({ total: sql.counts.get().threats, items: rows });
  }));
  router.get('/threats/:id', handle((req, res) => {
    const id = slugParam(req, res); if (!id) return;
    const row = sql.threatById.get(id);
    return row ? res.json(row) : notFound(res, 'Загрозу');
  }));

  /* ---------- Інциденти (лише читання, фільтр ?status=, сортування ?sort=) ---------- */
  const incidentFilters = {
    all: () => true,
    restricted: x => x.status.includes('ОБМЕЖЕНО'),
    open: x => x.status.includes('ВІДКРИТО'),
    closed: x => !x.status.includes('ОБМЕЖЕНО') && !x.status.includes('ВІДКРИТО'),
  };
  router.get('/incidents', handle((req, res) => {
    const filter = incidentFilters[req.query.status] || incidentFilters.all;
    const direction = req.query.sort === 'oldest' ? 1 : -1;
    const all = sql.incidentList.all();
    const items = all.filter(filter).sort((a, b) => direction * a.sort.localeCompare(b.sort));
    res.json({ total: all.length, items });
  }));
  router.get('/incidents/:id', handle((req, res) => {
    const id = slugParam(req, res); if (!id) return;
    const row = sql.incidentById.get(id);
    if (!row) return notFound(res, 'Інцидент');
    res.json({ ...row, factions: parseJson(row.factions), links: parseJson(row.links), artifacts: parseJson(row.artifacts) });
  }));

  /* ---------- Рапорти: повний CRUD ---------- */
  router.get('/reports', handle((req, res) => {
    const where = [];
    const params = [];
    const q = clean(req.query.q).slice(0, 80);
    if (q) { where.push('(r.title LIKE ? OR r.body LIKE ? OR r.agent LIKE ? OR r.location LIKE ?)'); params.push(...Array(4).fill(`%${q}%`)); }
    if (STATUSES.includes(req.query.status)) { where.push('r.status = ?'); params.push(req.query.status); }
    if (PRIORITIES.includes(req.query.priority)) { where.push('r.priority = ?'); params.push(req.query.priority); }
    const rows = db.prepare(`SELECT r.id, r.title, r.agent, r.location, r.priority, r.status, r.incident_id AS incidentId,
                               i.code AS incidentCode, r.body, r.created_at AS createdAt, r.updated_at AS updatedAt
                             FROM reports r LEFT JOIN incidents i ON i.id = r.incident_id
                             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                             ORDER BY r.updated_at DESC, r.id DESC`).all(...params);
    res.json({ total: sql.counts.get().reports, items: rows });
  }));

  router.get('/reports/:id', handle((req, res) => {
    const id = reportIdParam(req, res); if (!id) return;
    const row = sql.reportById.get(id);
    return row ? res.json(row) : notFound(res, 'Рапорт');
  }));

  router.post('/reports', handle((req, res) => {
    const { value, errors } = validateReport(req.body, { incidentExists });
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Перевірте поля рапорту.', fields: errors });
    const info = sql.reportInsert.run(value.title, value.agent, value.location, value.priority, value.status, value.incidentId, value.body);
    const created = sql.reportById.get(Number(info.lastInsertRowid));
    res.status(201).location(`/api/reports/${created.id}`).json(created);
  }));

  router.put('/reports/:id', handle((req, res) => {
    const id = reportIdParam(req, res); if (!id) return;
    if (!sql.reportById.get(id)) return notFound(res, 'Рапорт');
    const { value, errors } = validateReport(req.body, { incidentExists });
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Перевірте поля рапорту.', fields: errors });
    sql.reportUpdate.run(value.title, value.agent, value.location, value.priority, value.status, value.incidentId, value.body, id);
    res.json(sql.reportById.get(id));
  }));

  router.delete('/reports/:id', handle((req, res) => {
    const id = reportIdParam(req, res); if (!id) return;
    const info = sql.reportDelete.run(id);
    return info.changes ? res.status(204).end() : notFound(res, 'Рапорт');
  }));

  /* ---------- Невідомий маршрут API ---------- */
  router.use((req, res) => res.status(404).json({ error: 'Маршрут API не знайдено.' }));

  return router;
}

module.exports = { createApiRouter };
