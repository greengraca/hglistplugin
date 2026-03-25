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
