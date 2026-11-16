// Збирає Express-застосунок: безпека, стиснення, статичні файли клієнта та REST API.
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createApiRouter } = require('./routes');
const { createPhotoService } = require('./photos');

function createApp(db, config) {
  const app = express();
  const photos = createPhotoService(config.publicDir);
  app.set('trust proxy', 1); // за проксі хостингу (Render) коректно визначаємо IP клієнта

  // Заголовки безпеки + Content-Security-Policy: скрипти лише з власного домену, шрифти — з Google Fonts.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use(compression());

  // Загальний ліміт на API та суворіший — на зміну даних.
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.writeLimit,
    skip: req => req.method === 'GET',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Забагато змін за короткий час. Спробуйте пізніше.' },
  }));

  app.use('/api', express.json({ limit: '16kb' }));
  app.use('/api', createApiRouter(db, photos));

  // Фото записів: якщо файлу в public/photos немає — запасна ілюстрація замість 404.
  app.use('/photos', photos.fallbackMiddleware);

  // Статичні файли клієнта з кешуванням (HTML — без кешу, щоб оновлення було видно одразу).
  app.use(express.static(config.publicDir, {
    extensions: ['html'],
    maxAge: config.env === 'production' ? '7d' : 0,
    setHeaders(res, filePath) {
      // HTML і фото з public/photos — без довгого кешу, щоб оновлення й нові фото було видно одразу.
      if (filePath.endsWith('.html') || /[\\/]photos[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  app.use((req, res) => res.status(404).sendFile('404.html', { root: config.publicDir }));

  // Загальний обробник помилок: деталі — лише в журнал сервера, клієнту — коротке повідомлення.
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некоректний JSON у тілі запиту.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Завеликий запит.' });
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Внутрішня помилка сервера.' });
  });

  return app;
}

module.exports = { createApp };
