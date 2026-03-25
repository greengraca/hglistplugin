const app = () => document.getElementById('app');

// Escape HTML entities to prevent XSS from external data (Scryfall API, DOM scraping)
function esc(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function renderOffSite() {
  app().innerHTML = `
    <div class="view off-site">
      <h2>Hunting Grounds Listing Plugin</h2>
      <p class="message">Navigate to Cardmarket to get started.</p>
    </div>
  `;
}

export function renderAutoMode({ detectedSet, unmatchedSetName, onDetect, onSearch, onBrowseSets, onSettings }) {
  const unmatchedHtml = unmatchedSetName && !detectedSet
    ? `<p class="error">Could not match set '${esc(unmatchedSetName)}' to Scryfall. <button id="btn-manual-fallback" class="link-btn">Use manual search</button></p>`
    : '';

  app().innerHTML = `
    <div class="view auto-mode">
      <div class="header">
        <h2>Hunting Grounds Listing Plugin</h2>
        <button id="btn-settings" class="icon-btn" title="Settings">&#9881;</button>
      </div>
      <div class="detected-set">
        <span class="label">Detected Set:</span>
        <span class="value">${detectedSet ? esc(detectedSet) : 'None'}</span>
        <button id="btn-detect" class="small-btn">Detect</button>
      </div>
      ${unmatchedHtml}
      <form id="search-form" class="search-form">
        <input type="text" id="collector-number" placeholder="Collector number (e.g., 42, 100a)" autocomplete="off" required>
        <button type="submit" ${!detectedSet ? 'disabled' : ''}>Search</button>
      </form>
      <button id="btn-browse" class="link-btn">Browse Sets</button>
      <div id="result-area"></div>
    </div>
  `;

  document.getElementById('btn-detect').addEventListener('click', onDetect);
  document.getElementById('btn-browse').addEventListener('click', onBrowseSets);
  document.getElementById('btn-settings').addEventListener('click', onSettings);
  document.getElementById('btn-manual-fallback')?.addEventListener('click', onBrowseSets);
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const num = document.getElementById('collector-number').value.trim();
    if (num) onSearch(num);
  });
}

export function renderManualMode({ sets, onSelectSet, onAutoDetect, onSettings }) {
  app().innerHTML = `
    <div class="view manual-mode">
      <div class="header">
        <h2>Hunting Grounds Listing Plugin</h2>
        <button id="btn-settings" class="icon-btn" title="Settings">&#9881;</button>
      </div>
      <div class="search-set">
        <label for="set-search">Search expansion:</label>
        <input type="text" id="set-search" placeholder="Type set name..." autocomplete="off">
        <ul id="set-results" class="autocomplete-list"></ul>
      </div>
      <button id="btn-auto" class="link-btn">Auto Detect</button>
      <div id="result-area"></div>
    </div>
  `;

  document.getElementById('btn-auto').addEventListener('click', onAutoDetect);
  document.getElementById('btn-settings').addEventListener('click', onSettings);

  const input = document.getElementById('set-search');
  const list = document.getElementById('set-results');

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    list.innerHTML = '';
    if (query.length < 2) return;

    const matches = sets.filter(s =>
      s.name.toLowerCase().includes(query)
    ).slice(0, 15);

    matches.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s.name;
      li.addEventListener('click', () => {
        list.innerHTML = '';
        input.value = s.name;
        onSelectSet(s);
      });
      list.appendChild(li);
    });
  });
}

export function renderManualWithCollector({ selectedSet, onSearch, onBack, onSettings }) {
  app().innerHTML = `
    <div class="view manual-mode">
      <div class="header">
        <h2>Hunting Grounds Listing Plugin</h2>
        <button id="btn-settings" class="icon-btn" title="Settings">&#9881;</button>
      </div>
      <div class="detected-set">
        <span class="label">Selected Set:</span>
        <span class="value">${esc(selectedSet.name)}</span>
        <button id="btn-back" class="small-btn">Change</button>
      </div>
      <form id="search-form" class="search-form">
        <input type="text" id="collector-number" placeholder="Collector number (e.g., 42, 100a)" autocomplete="off" required>
        <button type="submit">Search</button>
      </form>
      <div id="result-area"></div>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', onBack);
  document.getElementById('btn-settings').addEventListener('click', onSettings);
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const num = document.getElementById('collector-number').value.trim();
    if (num) onSearch(num);
  });
}

export function renderResult({ card, cardmarketHref, onSearchAgain }) {
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;

  let linkHtml = '';
  if (cardmarketHref) {
    linkHtml = `<a href="${esc(cardmarketHref)}" id="cardmarket-link" class="cardmarket-link">View on Cardmarket</a>`;
  } else {
    linkHtml = `<p class="no-link">Cardmarket link unavailable for this printing.</p>`;
  }

  resultArea.innerHTML = `
    <div class="result-card">
      <h3 class="card-name">${esc(card.name)}</h3>
      ${card.imageUrl ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}" class="card-image">` : ''}
      ${linkHtml}
      <button id="btn-again" class="link-btn">Search again</button>
    </div>
  `;

  document.getElementById('btn-again').addEventListener('click', onSearchAgain);

  // Navigate in same tab instead of opening a new one
  const cmLink = document.getElementById('cardmarket-link');
  if (cmLink) {
    cmLink.addEventListener('click', (e) => {
      e.preventDefault();
      const href = cmLink.getAttribute('href');
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) chrome.tabs.update(tab.id, { url: href });
      });
    });
  }
}

export function renderError(message) {
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;
  resultArea.innerHTML = `<p class="error">${esc(message)}</p>`;
}

export function renderLoading() {
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;
  resultArea.innerHTML = `<p class="loading">Looking up card...</p>`;
}

export function renderSettings({ sellerCountry, languageFilter, onSave, onBack }) {
  app().innerHTML = `
    <div class="view settings">
      <div class="header">
        <h2>Settings</h2>
      </div>
      <form id="settings-form">
        <label for="seller-country">Seller Country (ID):</label>
        <input type="number" id="seller-country" value="${esc(sellerCountry)}" min="1">

        <label for="language-filter">Language Filter (comma-separated IDs):</label>
        <input type="text" id="language-filter" value="${esc(languageFilter)}" placeholder="1,8">

        <div class="settings-actions">
          <button type="submit">Save</button>
          <button type="button" id="btn-back">Back</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', onBack);
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    onSave({
      sellerCountry: parseInt(document.getElementById('seller-country').value, 10),
      languageFilter: document.getElementById('language-filter').value.trim()
    });
  });
}
