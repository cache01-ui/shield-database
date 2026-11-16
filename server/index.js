// Точка входу: відкриває базу даних і запускає HTTP-сервер.
const config = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

const db = openDatabase(config.dbPath);
const app = createApp(db, config);

const server = app.listen(config.port, () => {
  console.log(`S.H.I.E.L.D. database: http://localhost:${config.port} (${config.env})`);
});

// Коректне завершення: закриваємо з'єднання й базу даних.
const shutdown = signal => {
  console.log(`${signal}: зупинка сервера…`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
