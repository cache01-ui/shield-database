/* =====================================================================
   dossier_profile.js — профіль оперативника (дані з REST API)
   Inline-скрипт винесено в окремий файл: політика CSP дозволяє лише власні скрипти.
   ===================================================================== */

const dossierContent = document.getElementById('dossier-content');
const dossierHeading = document.getElementById('profile-heading');
const dossierId = new URLSearchParams(location.search).get('id') || 'stark';
const dossierBody = document.createElement('div');
dossierBody.className = 'dossier-columns';
dossierContent.append(dossierBody);

async function loadDossier() {
  renderState(dossierBody, 'loading', 'ЗАВАНТАЖЕННЯ ДОСЬЄ…');
  try {
    const dossier = await api.dossier(dossierId);
    document.title = dossier.title;
    dossierHeading.textContent = dossier.title.replace(/^S\.H\.I\.E\.L\.D\. — /, '');
    dossierBody.innerHTML = dossier.html; // довірені дані з початкового наповнення бази
  } catch (error) {
    renderState(dossierBody, 'error',
      error.status === 404 ? 'Досьє не знайдено. Поверніться до каталогу.' : error.message,
      error.status === 404 ? null : loadDossier);
  }
}

loadDossier();
