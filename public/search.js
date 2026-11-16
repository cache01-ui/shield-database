// Пошук по картках каталогу (досьє, артефакти).
// Поле пошуку вказує селектор карток в атрибуті data-search-cards.
document.querySelectorAll('[data-search-cards]').forEach(input => {
  const cards = [...document.querySelectorAll(input.dataset.searchCards)];
  const emptyState = document.querySelector('.empty-state');

  const filterCards = () => {
    const query = input.value.toLowerCase().trim();
    let visible = 0;

    cards.forEach(card => {
      const name = card.querySelector('.agent-name')?.textContent ?? '';
      const desc = card.querySelector('.agent-desc')?.textContent ?? '';
      const keywords = card.dataset.keywords ?? '';
      const match = `${name} ${desc} ${keywords}`.toLowerCase().includes(query);
      card.hidden = !match;
      if (match) visible++;
    });

    if (emptyState) emptyState.hidden = visible > 0;
    if (typeof updateResultCount === 'function') updateResultCount(visible, cards.length);
  };

  input.addEventListener('input', filterCards);
  filterCards();
});
