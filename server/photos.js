// Фотографії, які користувач додає в public/photos/ під іменем запису (напр. kang.png).
// Якщо фото немає — використовується запасна ілюстрація, тому в консолі не буде помилок 404.
const fs = require('node:fs');
const path = require('node:path');

const EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

// Запасні SVG для артефактів (сторінка artifacts.html статична й посилається на photos/<ім'я>.png).
const ARTIFACT_FALLBACKS = {
  tesseract: 'art-tesseract.svg',
  'mind-stone': 'art-mind-stone.svg',
  'power-stone': 'art-power-stone.svg',
  'infinity-stones': 'art-infinity.svg',
  mjolnir: 'art-mjolnir.svg',
  shield: 'art-shield.svg',
  scepter: 'art-scepter.svg',
  'eye-of-agamotto': 'art-eye.svg',
};

function createPhotoService(publicDir) {
  const dir = path.join(publicDir, 'photos');

  /** Повертає шлях до фото запису (photos/<id>.<ext>) або null, якщо файлу немає. */
  function findPhoto(id) {
    for (const ext of EXTENSIONS) {
      if (fs.existsSync(path.join(dir, id + ext))) return `photos/${id}${ext}`;
    }
    return null;
  }

  /** Middleware: якщо запитаного фото артефакту немає, віддаємо запасну SVG-ілюстрацію. */
  function fallbackMiddleware(req, res, next) {
    const file = path.basename(decodeURIComponent(req.path));
    if (fs.existsSync(path.join(dir, file))) return next();
    const base = file.replace(/\.(png|jpe?g|webp)$/i, '');
    const fallback = ARTIFACT_FALLBACKS[base];
    if (!fallback) return next();
    res.set('Cache-Control', 'no-cache'); // щоб додане пізніше фото з’явилося одразу
    res.type('image/svg+xml').sendFile(fallback, { root: publicDir });
  }

  return { findPhoto, fallbackMiddleware };
}

module.exports = { createPhotoService, ARTIFACT_FALLBACKS };
