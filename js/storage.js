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
