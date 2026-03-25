# Cardmarket Card Lookup Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome side panel extension that looks up MTG card names from collector numbers using the Scryfall API, while browsing Cardmarket.

**Architecture:** Manifest V3 Chrome extension with three components: service worker (side panel availability), content script (DOM scraping on Cardmarket), and side panel UI (views, API calls, display). Vanilla JS with ES modules (`type="module"` in side panel HTML) for clean decomposition without a build step.

**Tech Stack:** Chrome Extension APIs (sidePanel, storage, tabs, runtime), Scryfall REST API, vanilla HTML/CSS/JS with ES modules.

**Spec:** `docs/superpowers/specs/2026-03-25-cardmarket-lookup-extension-design.md`

---

## File Structure

```
hglistplugin/
  manifest.json          — Extension manifest (MV3)
  background.js          — Service worker: side panel availability per tab
  content.js             — Content script: scrape set name from Cardmarket DOM
  sidepanel.html         — Side panel HTML shell, loads modules
  sidepanel.css          — All side panel styles
  sidepanel.js           — Main entry: view management, event wiring
  js/
    scryfall.js          — Scryfall API: fetchSets(), lookupCard(), resolveSetCode()
    storage.js           — chrome.storage.local: settings CRUD, set cache with TTL
    views.js             — DOM manipulation: render each view state
    clipboard.js         — Clipboard copy + toast notification
  icons/
    icon16.png
    icon32.png
    icon48.png
    icon128.png
```

**Rationale for `js/` modules:** The side panel is the largest component. Splitting API calls, storage, view rendering, and clipboard into focused modules keeps each file small and testable. The side panel HTML loads `sidepanel.js` as `type="module"`, which imports from `js/`. Note: this departs from the spec's flat file structure — the `js/` subdirectory is a deliberate improvement for maintainability.

---

### Task 1: Extension Skeleton — Manifest + Empty Files

**Files:**
- Create: `manifest.json`
- Create: `background.js` (empty placeholder)
- Create: `content.js` (empty placeholder)
- Create: `sidepanel.html` (minimal HTML)
- Create: `sidepanel.css` (empty)
- Create: `sidepanel.js` (empty)

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "HG List Plugin",
  "version": "1.0.0",
  "description": "Look up MTG card names by collector number on Cardmarket using Scryfall.",
  "action": {},
  "permissions": ["sidePanel", "activeTab", "storage"],
  "host_permissions": [
    "https://www.cardmarket.com/*",
    "https://api.scryfall.com/*"
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "content_scripts": [
    {
      "matches": ["https://www.cardmarket.com/*/Magic/Products/Singles/*"],
      "js": ["content.js"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Create minimal `sidepanel.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HG List</title>
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="sidepanel.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create empty placeholder files**

Create empty files: `background.js`, `content.js`, `sidepanel.js`, `sidepanel.css`

- [ ] **Step 4: Load in Chrome and verify**

1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" → select the `hglistplugin/` folder
4. Verify: extension appears with no errors
5. Click the extension icon → side panel opens showing "HG List Plugin loaded."

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js content.js sidepanel.html sidepanel.css sidepanel.js icons/
git commit -m "feat: extension skeleton with manifest, side panel shell, and placeholder icons"
```

---

### Task 2: Service Worker — Side Panel Availability

**Files:**
- Modify: `background.js`

The service worker enables the side panel on Cardmarket tabs and handles the extension icon click to open the panel.

- [ ] **Step 1: Implement `background.js`**

```js
// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
```

Note: The side panel is enabled globally via the manifest's `side_panel.default_path`. The side panel JS handles the view logic (off-site vs on-site) based on the active tab URL.

- [ ] **Step 2: Verify in Chrome**

1. Reload extension
2. Navigate to any page → click extension icon → side panel opens
3. No console errors in `chrome://extensions/` service worker logs

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: service worker to manage side panel availability"
```

---

### Task 3: Storage Module

**Files:**
- Create: `js/storage.js`

Handles settings (sellerCountry, languageFilter) and the Scryfall set cache with 24h TTL.

- [ ] **Step 1: Create `js/storage.js`**

```js
const DEFAULTS = {
  sellerCountry: 26,
  languageFilter: '1,8'
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getSettings() {
  const result = await chrome.storage.local.get(['sellerCountry', 'languageFilter']);
  return {
    sellerCountry: result.sellerCountry ?? DEFAULTS.sellerCountry,
    languageFilter: result.languageFilter ?? DEFAULTS.languageFilter
  };
}

export async function saveSettings({ sellerCountry, languageFilter }) {
  await chrome.storage.local.set({ sellerCountry, languageFilter });
}

export async function getCachedSets() {
  const result = await chrome.storage.local.get(['scryfallSets', 'scryfallSetsCachedAt']);
  if (!result.scryfallSets || !result.scryfallSetsCachedAt) return null;
  const age = Date.now() - result.scryfallSetsCachedAt;
  if (age > CACHE_TTL) return null;
  return result.scryfallSets;
}

export async function cacheSets(sets) {
  await chrome.storage.local.set({
    scryfallSets: sets,
    scryfallSetsCachedAt: Date.now()
  });
}
```

- [ ] **Step 2: Verify module loads**

Temporarily add `import { getSettings } from './js/storage.js';` to `sidepanel.js` and `console.log(await getSettings());`. Reload extension, open side panel, check console for `{ sellerCountry: 26, languageFilter: '1,8' }`.

- [ ] **Step 3: Remove test code, commit**

```bash
git add js/storage.js sidepanel.js
git commit -m "feat: storage module for settings and set cache with 24h TTL"
```

---

### Task 4: Scryfall API Module

**Files:**
- Create: `js/scryfall.js`

Handles fetching the set list, resolving set names to codes, and looking up cards.

- [ ] **Step 1: Create `js/scryfall.js`**

```js
import { getCachedSets, cacheSets } from './storage.js';

const USER_AGENT = 'HGListPlugin/1.0';

// Note: User-Agent is a forbidden header in browser fetch() and will be silently dropped.
// We set it anyway as a best-effort courtesy; browsers send their own User-Agent.
const FETCH_OPTIONS = {
  headers: { 'User-Agent': USER_AGENT }
};

export async function fetchSets() {
  // Check cache first
  const cached = await getCachedSets();
  if (cached) return cached;

  const response = await fetch('https://api.scryfall.com/sets', FETCH_OPTIONS);
  if (!response.ok) throw new Error(`Scryfall sets API error: ${response.status}`);

  const data = await response.json();
  // Store only code and name to minimize storage footprint
  const sets = data.data.map(s => ({ code: s.code, name: s.name }));
  await cacheSets(sets);
  return sets;
}

export function resolveSetCode(setName, sets) {
  const normalize = (str) =>
    str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9\s]/g, '') // strip punctuation
      .trim();

  const needle = normalize(setName);

  // Exact match
  const exact = sets.find(s => normalize(s.name) === needle);
  if (exact) return exact.code;

  // Partial match
  const partial = sets.find(s => normalize(s.name).includes(needle) || needle.includes(normalize(s.name)));
  if (partial) return partial.code;

  return null;
}

export async function lookupCard(setCode, collectorNumber) {
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(collectorNumber)}`;
  const response = await fetch(url, FETCH_OPTIONS);

  if (response.status === 404) {
    return { error: 'not_found' };
  }
  if (!response.ok) {
    return { error: 'network' };
  }

  const card = await response.json();

  // Resolve image URL (top-level or DFC fallback)
  const imageUrl = card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? null;

  // Resolve Cardmarket purchase URL
  const cardmarketUrl = card.purchase_uris?.cardmarket ?? null;

  return {
    name: card.name,
    imageUrl,
    cardmarketUrl,
    setName: card.set_name,
    collectorNumber: card.collector_number
  };
}
```

- [ ] **Step 2: Verify API calls**

Temporarily add to `sidepanel.js`:
```js
import { fetchSets, lookupCard } from './js/scryfall.js';
const sets = await fetchSets();
console.log('Sets loaded:', sets.length);
const card = await lookupCard('fdn', '1');
console.log('Card:', card);
```

Open side panel, check console: sets count (~1000+) and card name logged.

- [ ] **Step 3: Remove test code, commit**

```bash
git add js/scryfall.js
git commit -m "feat: Scryfall API module with set caching, name resolution, and card lookup"
```

---

### Task 5: Content Script — DOM Scraping

**Files:**
- Modify: `content.js`

Listens for a `"detect-set"` message and scrapes the expansion name from the Cardmarket page.

- [ ] **Step 1: Implement `content.js`**

```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'detect-set') return;

  try {
    const setName = scrapeSetName();
    sendResponse({ setName, pageUrl: window.location.href });
  } catch (e) {
    sendResponse({ error: e.message });
  }

  // return true keeps message channel open — needed if scraping logic becomes async in the future
  return true;
});

function scrapeSetName() {
  // Strategy 1: Breadcrumb — Cardmarket breadcrumbs typically contain the set name
  // Path: Home > Magic > Singles > {Set Name} > {Card Name}
  const breadcrumbs = document.querySelectorAll('nav.breadcrumb li, ol.breadcrumb li, .breadcrumb a, [class*="Breadcrumb"] a');
  if (breadcrumbs.length >= 4) {
    // The set name is typically the second-to-last breadcrumb
    const setElement = breadcrumbs[breadcrumbs.length - 2];
    const text = setElement?.textContent?.trim();
    if (text && text.length > 1) return text;
  }

  // Strategy 2: Look for expansion name in product/card detail area
  // Cardmarket often has the set name in an element near the card title
  const expansionEl = document.querySelector('[class*="expansion"], [class*="Expansion"], [data-expansion]');
  if (expansionEl) {
    const text = expansionEl.textContent.trim();
    if (text) return text;
  }

  // Strategy 3: Extract from URL path
  // URL format: /en/Magic/Products/Singles/{SetName}/{CardName}
  const pathParts = window.location.pathname.split('/');
  const singlesIdx = pathParts.indexOf('Singles');
  if (singlesIdx !== -1 && pathParts[singlesIdx + 1]) {
    return decodeURIComponent(pathParts[singlesIdx + 1]).replace(/-/g, ' ');
  }

  throw new Error('Could not detect set name from page');
}
```

- [ ] **Step 2: Verify on a Cardmarket page**

1. Reload extension
2. Navigate to a Cardmarket singles page (e.g., any MTG card page)
3. Open DevTools console on the page, run:
   ```js
   chrome.runtime.sendMessage(chrome.runtime.id, { type: 'detect-set' }, console.log)
   ```
   (This won't work from page console — verify via side panel in next task)

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "feat: content script to scrape set name from Cardmarket DOM"
```

---

### Task 6: Clipboard + Toast Module

**Files:**
- Create: `js/clipboard.js`

- [ ] **Step 1: Create `js/clipboard.js`**

```js
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
    return true;
  } catch (e) {
    console.error('Clipboard write failed:', e);
    showToast('Failed to copy to clipboard');
    return false;
  }
}

function showToast(message) {
  // Remove existing toast if any
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/clipboard.js
git commit -m "feat: clipboard copy with toast notification"
```

---

### Task 7: Views Module — DOM Rendering

**Files:**
- Create: `js/views.js`

Handles rendering each view state into the `#app` container.

- [ ] **Step 1: Create `js/views.js`**

```js
const app = () => document.getElementById('app');

// Escape HTML entities to prevent XSS from external data (Scryfall API, DOM scraping)
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderOffSite() {
  app().innerHTML = `
    <div class="view off-site">
      <h2>HG List</h2>
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
        <h2>HG List</h2>
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
        <h2>HG List</h2>
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
        <h2>HG List</h2>
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
    linkHtml = `<a href="${esc(cardmarketHref)}" target="_blank" rel="noopener" class="cardmarket-link">View on Cardmarket</a>`;
  } else {
    linkHtml = `<p class="no-link">Cardmarket link unavailable for this printing.</p>`;
  }

  resultArea.innerHTML = `
    <div class="result-card">
      <h3 class="card-name">${esc(card.name)}</h3>
      <div id="clipboard-status" class="clipboard-status"></div>
      ${card.imageUrl ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}" class="card-image">` : ''}
      ${linkHtml}
      <button id="btn-again" class="link-btn">Search again</button>
    </div>
  `;

  document.getElementById('btn-again').addEventListener('click', onSearchAgain);
}

export function renderError(message) {
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;
  resultArea.innerHTML = `<p class="error">${message}</p>`;
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
        <input type="number" id="seller-country" value="${sellerCountry}" min="1">

        <label for="language-filter">Language Filter (comma-separated IDs):</label>
        <input type="text" id="language-filter" value="${languageFilter}" placeholder="1,8">

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
```

- [ ] **Step 2: Commit**

```bash
git add js/views.js
git commit -m "feat: views module with all side panel view renderers"
```

---

### Task 8: Side Panel CSS

**Files:**
- Modify: `sidepanel.css`

Minimal, clean styling for all views.

- [ ] **Step 1: Write `sidepanel.css`**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  background: #fafafa;
  padding: 16px;
}

h2 {
  font-size: 18px;
  font-weight: 600;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 4px;
}

.icon-btn:hover {
  color: #1a1a1a;
}

/* Detected / Selected set */
.detected-set {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f0f0f0;
  border-radius: 6px;
}

.detected-set .label {
  font-size: 12px;
  color: #666;
}

.detected-set .value {
  font-weight: 600;
  flex: 1;
}

.small-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: #e0e0e0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.small-btn:hover {
  background: #d0d0d0;
}

/* Search form */
.search-form {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-form input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.search-form input:focus {
  outline: none;
  border-color: #4a90d9;
}

.search-form button {
  padding: 8px 16px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.search-form button:hover:not(:disabled) {
  background: #3a7bc8;
}

.search-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Link-style buttons */
.link-btn {
  background: none;
  border: none;
  color: #4a90d9;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 0;
  text-decoration: underline;
}

.link-btn:hover {
  color: #3a7bc8;
}

/* Autocomplete */
.search-set {
  margin-bottom: 12px;
}

.search-set label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.search-set input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.search-set input:focus {
  outline: none;
  border-color: #4a90d9;
}

.autocomplete-list {
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 6px 6px;
}

.autocomplete-list:empty {
  border: none;
}

.autocomplete-list li {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.autocomplete-list li:hover {
  background: #e8f0fe;
}

/* Result card */
.result-card {
  margin-top: 16px;
  padding: 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.card-name {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.clipboard-status {
  font-size: 12px;
  color: #27ae60;
  min-height: 18px;
  margin-bottom: 8px;
}

.card-image {
  width: 100%;
  max-width: 300px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.cardmarket-link {
  display: inline-block;
  padding: 8px 16px;
  background: #4a90d9;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 8px;
}

.cardmarket-link:hover {
  background: #3a7bc8;
}

.no-link {
  font-size: 12px;
  color: #999;
  font-style: italic;
  margin-bottom: 8px;
}

/* Messages */
.off-site {
  text-align: center;
  padding-top: 40px;
}

.message {
  color: #666;
  margin-top: 12px;
}

.error {
  color: #e74c3c;
  margin-top: 8px;
  font-size: 13px;
}

.loading {
  color: #666;
  margin-top: 8px;
  font-size: 13px;
}

/* Settings */
.settings form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.settings input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.settings-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.settings-actions button[type="submit"] {
  background: #4a90d9;
  color: white;
}

.settings-actions button[type="button"] {
  background: #e0e0e0;
}

/* Toast */
#toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #333;
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
  z-index: 1000;
}

#toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
```

- [ ] **Step 2: Commit**

```bash
git add sidepanel.css
git commit -m "feat: side panel styles for all views"
```

---

### Task 9: Side Panel Main Entry — Wiring Everything Together

**Files:**
- Modify: `sidepanel.js`

This is the main orchestrator. It imports all modules and wires up the view transitions, API calls, and state management.

- [ ] **Step 1: Implement `sidepanel.js`**

```js
import { getSettings, saveSettings } from './js/storage.js';
import { fetchSets, resolveSetCode, lookupCard } from './js/scryfall.js';
import { copyToClipboard } from './js/clipboard.js';
import {
  renderOffSite, renderAutoMode, renderManualMode,
  renderManualWithCollector, renderResult, renderError,
  renderLoading, renderSettings
} from './js/views.js';

// State
let state = {
  mode: 'auto',         // 'auto' | 'manual'
  detectedSet: null,     // { name, code } or null
  selectedSet: null,     // { name, code } for manual mode
  sets: [],              // cached Scryfall set list
  previousMode: 'auto', // for returning from settings
  unmatchedSetName: null // set name that couldn't be resolved
};

// ---- Initialization ----

async function init() {
  // Load sets in background
  try {
    state.sets = await fetchSets();
  } catch (e) {
    console.error('Failed to load sets:', e);
  }

  // Check if we're on Cardmarket
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('cardmarket.com')) {
    renderOffSite();
    return;
  }

  // Initial detection attempt
  await detectSet(tab.id);
  showAutoMode();
}

// ---- Detection ----

async function detectSet(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'detect-set' });
    if (response?.error || !response?.setName) {
      state.detectedSet = null;
      return;
    }

    const code = resolveSetCode(response.setName, state.sets);
    if (code) {
      state.detectedSet = { name: response.setName, code };
    } else {
      state.detectedSet = null;
      state.unmatchedSetName = response.setName;
    }
  } catch (e) {
    // Content script not available (not a Singles page)
    state.detectedSet = null;
  }
}

// ---- Card Search ----

async function searchCard(setCode, collectorNumber) {
  renderLoading();

  try {
    const result = await lookupCard(setCode, collectorNumber);

    if (result.error === 'not_found') {
      renderError(`No card found for ${setCode} #${collectorNumber}.`);
      return;
    }
    if (result.error === 'network') {
      renderError('Network error. Check your connection and try again.');
      return;
    }

    // Build Cardmarket link with user settings
    const settings = await getSettings();
    let cardmarketHref = null;
    if (result.cardmarketUrl) {
      const url = new URL(result.cardmarketUrl);
      url.searchParams.set('sellerCountry', settings.sellerCountry);
      url.searchParams.set('language', settings.languageFilter);
      cardmarketHref = url.toString();
    }

    renderResult({
      card: result,
      cardmarketHref,
      onSearchAgain: () => {
        if (state.mode === 'auto') showAutoMode();
        else if (state.selectedSet) showManualCollector();
        else showManualMode();
      }
    });

    // Auto-copy card name to clipboard
    await copyToClipboard(result.name);
  } catch (e) {
    console.error('Search failed:', e);
    renderError('Something went wrong. Try again.');
  }
}

// ---- View Transitions ----

function showAutoMode() {
  state.mode = 'auto';
  renderAutoMode({
    detectedSet: state.detectedSet?.name || null,
    unmatchedSetName: state.unmatchedSetName,
    onDetect: async () => {
      state.unmatchedSetName = null;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await detectSet(tab.id);
        showAutoMode();
      }
    },
    onSearch: (num) => {
      if (state.detectedSet) {
        searchCard(state.detectedSet.code, num);
      }
    },
    onBrowseSets: () => showManualMode(),
    onSettings: () => showSettings('auto')
  });
}

function showManualMode() {
  state.mode = 'manual';
  state.selectedSet = null;
  renderManualMode({
    sets: state.sets,
    onSelectSet: (set) => {
      state.selectedSet = set;
      showManualCollector();
    },
    onAutoDetect: () => showAutoMode(),
    onSettings: () => showSettings('manual')
  });
}

function showManualCollector() {
  renderManualWithCollector({
    selectedSet: state.selectedSet,
    onSearch: (num) => searchCard(state.selectedSet.code, num),
    onBack: () => showManualMode(),
    onSettings: () => showSettings('manual')
  });
}

async function showSettings(returnTo) {
  state.previousMode = returnTo;
  const settings = await getSettings();
  renderSettings({
    ...settings,
    onSave: async (newSettings) => {
      await saveSettings(newSettings);
      if (state.previousMode === 'auto') showAutoMode();
      else showManualMode();
    },
    onBack: () => {
      if (state.previousMode === 'auto') showAutoMode();
      else showManualMode();
    }
  });
}

// ---- Start ----

init();
```

- [ ] **Step 2: Verify end-to-end on Cardmarket**

1. Reload extension
2. Navigate to a Cardmarket Singles page
3. Open side panel → should show Auto Mode with detected set
4. Enter a collector number → should show card name + image + Cardmarket link
5. Verify "Copied to clipboard!" toast appears
6. Paste somewhere → card name is in clipboard

- [ ] **Step 3: Verify manual mode**

1. Click "Browse Sets" → type a set name → autocomplete appears
2. Select a set → collector number input appears
3. Enter number → card displays correctly

- [ ] **Step 4: Verify settings**

1. Click gear icon → settings form appears
2. Change values → save → returns to previous mode
3. Search a card → Cardmarket link uses new settings values

- [ ] **Step 5: Verify off-site behavior**

1. Navigate to a non-Cardmarket page
2. Open side panel → shows "Navigate to Cardmarket to get started."

- [ ] **Step 6: Verify error states**

1. On Cardmarket, enter an invalid collector number (e.g., "99999") → error message
2. Disconnect network → attempt search → network error message

- [ ] **Step 7: Commit**

```bash
git add sidepanel.js sidepanel.html
git commit -m "feat: side panel main entry wiring all views, API calls, and state management"
```

---

### Task 10: Placeholder Icons

**Files:**
- Create: `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Generate placeholder icons**

Use a simple script or tool to create solid-color PNG icons at the required sizes. A simple blue square with "HG" text works.

If no image tool is available, create minimal valid PNGs programmatically or use any available placeholder.

- [ ] **Step 2: Verify**

Reload extension in Chrome. Icon should appear in the extensions toolbar.

- [ ] **Step 3: Commit**

```bash
git add icons/
git commit -m "feat: add placeholder extension icons"
```

---

### Task 11: Final Verification + Polish

**Files:**
- Potentially any file for minor fixes

- [ ] **Step 1: Full end-to-end walkthrough**

Run through every flow:
1. Load extension fresh
2. Off-site view (non-Cardmarket page)
3. Auto mode detection on a Cardmarket Singles page
4. Card lookup with valid collector number
5. Clipboard copy confirmation
6. Cardmarket link opens correct page with settings params
7. "Search again" returns to input
8. "Browse Sets" → manual mode → autocomplete → select → collector input → search
9. Settings → save → verify persistence
10. Non-Singles Cardmarket page → detection fails gracefully
11. Invalid collector number → error message
12. DFC card (e.g., a transform card) → image displays correctly

- [ ] **Step 2: Fix any issues found**

Address any bugs or polish items discovered during walkthrough.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: final polish from end-to-end verification"
```
