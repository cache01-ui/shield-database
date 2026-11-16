// Робота з базою даних SQLite (вбудований модуль node:sqlite, без нативних залежностей).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS dossiers (
  id     TEXT PRIMARY KEY,
  title  TEXT NOT NULL,
  html   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threats (
  id          TEXT PRIMARY KEY,
  position    INTEGER NOT NULL,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  fullname    TEXT NOT NULL,
  callsign    TEXT NOT NULL,
  status      TEXT NOT NULL,
  badge       TEXT NOT NULL,
  threat      TEXT NOT NULL,
  role        TEXT NOT NULL,
  affiliation TEXT NOT NULL,
  image       TEXT NOT NULL,
  keywords    TEXT NOT NULL,
  summary     TEXT NOT NULL,
  bio         TEXT NOT NULL,
  equipment   TEXT NOT NULL,
  conclusion  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  date        TEXT NOT NULL,
  sort_key    TEXT NOT NULL,
  title       TEXT NOT NULL,
  location    TEXT NOT NULL,
  severity    TEXT NOT NULL,
  status      TEXT NOT NULL,
  description TEXT NOT NULL,
  story       TEXT NOT NULL,
  conclusion  TEXT NOT NULL,
  image       TEXT NOT NULL DEFAULT '',
  factions    TEXT NOT NULL DEFAULT '[]',   -- JSON-масив сторін конфлікту
  links       TEXT NOT NULL DEFAULT '[]',   -- JSON-масив пов'язаних записів
  artifacts   TEXT NOT NULL DEFAULT '[]'    -- JSON-масив артефактів
);

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 120),
  agent       TEXT NOT NULL,
  location    TEXT NOT NULL DEFAULT '',
  priority    TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status      TEXT NOT NULL CHECK (status IN ('draft', 'active', 'closed')),
  incident_id TEXT REFERENCES incidents(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 20 AND 4000),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_incident ON reports(incident_id);
CREATE INDEX IF NOT EXISTS idx_incidents_sort   ON incidents(sort_key);
`;

const readJson = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf8'));

/** Наповнює порожні таблиці початковими даними з server/data/*.json. */
function seed(db) {
  const count = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

  db.exec('BEGIN');
  try {
    if (count('dossiers') === 0) {
      const insert = db.prepare('INSERT INTO dossiers (id, title, html) VALUES (?, ?, ?)');
      for (const [id, d] of Object.entries(readJson('dossiers.json'))) insert.run(id, d.title, d.html);
    }

    if (count('threats') === 0) {
      const insert = db.prepare(`INSERT INTO threats
        (id, position, code, name, fullname, callsign, status, badge, threat, role, affiliation, image, keywords, summary, bio, equipment, conclusion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      readJson('threats.json').forEach((t, i) => insert.run(
        t.id, i + 1, t.code, t.name, t.fullname, t.callsign, t.status, t.badge, t.threat, t.role,
        t.affiliation, t.image, t.keywords, t.summary, t.bio, t.equipment, t.conclusion));
    }

    if (count('incidents') === 0) {
      const insert = db.prepare(`INSERT INTO incidents
        (id, code, date, sort_key, title, location, severity, status, description, story, conclusion, image, factions, links, artifacts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const x of readJson('incidents.json')) {
        insert.run(x.id, x.code, x.date, x.sort, x.title, x.location, x.severity, x.status, x.description,
          x.story, x.conclusion, x.image || '', JSON.stringify(x.factions), JSON.stringify(x.links), JSON.stringify(x.artifacts));
      }
    }

    if (count('reports') === 0) {
      const insert = db.prepare(`INSERT INTO reports (title, agent, location, priority, status, incident_id, body)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const r of readJson('reports.json')) {
        insert.run(r.title, r.agent, r.location, r.priority, r.status, r.incidentId, r.body);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Відкриває (або створює) базу даних, застосовує схему та початкові дані. */
function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

module.exports = { openDatabase };
