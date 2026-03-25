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
