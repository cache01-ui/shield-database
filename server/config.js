// Налаштування застосунку беруться зі змінних середовища (файл .env або панель хостингу).
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || path.join(ROOT, 'data', 'shield.db'),
  publicDir: path.join(ROOT, 'public'),
  // Ліміти запитів на зміну даних (захист від спаму та перебору).
  writeLimit: Number(process.env.WRITE_LIMIT_PER_15_MIN) || 60,
};
