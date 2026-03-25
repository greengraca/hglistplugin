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
