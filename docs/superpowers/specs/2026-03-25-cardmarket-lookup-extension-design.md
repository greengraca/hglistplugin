# Cardmarket Card Lookup — Chrome Side Panel Extension

## Overview

A Chromium browser extension that helps users look up MTG card details while browsing Cardmarket. It uses Chrome's Side Panel API to provide a persistent, docked UI that detects the current card's expansion from the Cardmarket page, accepts a collector number, and returns the English card name, image, and a direct Cardmarket purchase link via the Scryfall API.

## Architecture

Three components, Manifest V3:

- **Side Panel** (`sidepanel.html` + `sidepanel.js`) — The UI. Rendered via `chrome.sidePanel` API.
- **Content Script** (`content.js`) — Injected into Cardmarket pages. Scrapes the expansion/set name from the DOM on demand.
- **Service Worker** (`background.js`) — Manages side panel availability via `chrome.sidePanel.setOptions()`. Enables the panel on any `cardmarket.com` page; the content script is limited to Singles pages only.

## User Flow

### Auto Mode (default view on panel open)

1. User opens the side panel while on a Cardmarket MTG single card page.
2. Side panel sends a one-time message to the content script to scrape the current page's expansion name.
3. Side panel displays: detected expansion name + a collector number input field.
4. User enters a collector number and submits.
5. Side panel calls Scryfall API: `GET https://api.scryfall.com/cards/{set_code}/{collector_number}`
6. Side panel displays: English card name, card image thumbnail, and a Cardmarket link.

### Detection Behavior (no auto-refresh)

- Detection happens **once** when the side panel is first opened.
- Navigating to a different Cardmarket page does **not** auto-update the panel.
- A **"Detect" button** in the panel allows the user to manually re-scrape the current page's set info when ready.
- This avoids unnecessary fetches and gives the user control.

### Manual Mode (Back button)

1. User clicks "Browse Sets" to switch to manual search view.
2. A text input with live autocomplete filters against a cached set list (from `https://api.scryfall.com/sets`).
3. User selects a set from the dropdown.
4. Same collector number input appears.
5. Same lookup and display as auto mode.

### Off-Site Behavior

- When the active tab is not on `cardmarket.com`, the side panel shows a message: "Navigate to Cardmarket to get started."
- When on `cardmarket.com` but not on a Singles page (e.g., homepage, seller page), treat the same as a failed detection — show the auto mode view with no detected set and prompt the user to use manual search.
- The side panel remains available but inactive off-site.

## Side Panel Views

### 1. Off-Site View
- Message: "Navigate to Cardmarket to get started."

### 2. Auto Mode View (default on Cardmarket)
- Detected expansion name (read-only display)
- "Detect" button to re-scrape current page
- Collector number input (text — collector numbers may contain letters, e.g., "100a", "12b")
- "Search" submit button
- Result area (initially hidden)

### 3. Manual Mode View
- "Browse Sets" button enters this view from auto mode; "Auto Detect" button returns to auto mode
- Set search input with live autocomplete dropdown
- After set selection: collector number input + submit
- Result area

### 4. Result Display
- Card English name (prominent)
- Card image thumbnail: use `image_uris.normal` if present at top level; if absent (double-faced cards), fall back to `card_faces[0].image_uris.normal`
- Cardmarket link button: use `purchase_uris.cardmarket` from the Scryfall response, appending user's country/language params via the `URL` API for safe query param handling. If `purchase_uris.cardmarket` is absent (digital-only or promo cards), show "Cardmarket link unavailable for this printing."
- "Search again" option to clear result and return to input

### 5. Settings View
- Accessible via gear icon
- Seller Country: numeric input (default: 26)
- Language filter: text input, comma-separated (default: "1,8")
- Save button, persisted to `chrome.storage.local`

## Data Flow

```
[Cardmarket Page DOM]
       |
       | (on-demand message from side panel)
       v
[Content Script] -- scrapes set name --> [Side Panel]
       |
       | (user enters collector #)
       v
[Side Panel] -- GET /cards/{set}/{num} --> [Scryfall API]
       |
       v
[Side Panel] -- renders card name, image, Cardmarket link
```

## Scryfall API Usage

### Set List (for manual mode autocomplete + set code resolution)
- Endpoint: `GET https://api.scryfall.com/sets`
- Fetched once, cached in `chrome.storage.local` with a 24-hour TTL. TTL is checked whenever the set list is needed (set name resolution or autocomplete entry). If expired, refresh in the background before proceeding.
- Used to: (a) resolve a scraped set name to a Scryfall set code, (b) power the manual mode autocomplete.

### Card Lookup
- Endpoint: `GET https://api.scryfall.com/cards/{set_code}/{collector_number}`
- Called on each user search submission.
- Response fields used: `name`, `image_uris.normal` (with `card_faces[0].image_uris.normal` fallback for DFCs), `set_name`, `collector_number`, `purchase_uris.cardmarket`.
- All requests must include a `User-Agent` header (e.g., `HGListPlugin/1.0`) per Scryfall's usage guidelines. The single-request-per-submit pattern is inherently compliant with Scryfall's 10 req/s rate limit.

## Set Name Resolution

Cardmarket displays expansion names that may differ from Scryfall's naming. Resolution strategy:

1. Normalize both strings: lowercase, strip accents/diacritics, remove punctuation.
2. Exact match first against Scryfall set names.
3. If no exact match, try `String.includes()` partial matching.
4. If still no match, fall back to manual mode and prompt the user to select.

## Cardmarket Link Construction

Use the `purchase_uris.cardmarket` URL returned by the Scryfall API response. This is a reliable, product-ID-based URL that avoids fragile slug construction. Append the user's configured query params:

```
{purchase_uris.cardmarket}&sellerCountry={country}&language={languages}
```

This eliminates the need for any slug logic or special-character handling.

## Content Script: DOM Scraping

Target: Cardmarket MTG single card pages (URL pattern: `cardmarket.com/*/Magic/Products/Singles/*`).

Scrape the expansion/set name from the page. Likely locations in Cardmarket's DOM:
- Breadcrumb navigation
- Card detail section (set name near the card title)
- Page metadata

The content script exposes a single message handler: when it receives a `"detect-set"` message, it scrapes and returns `{ setName: string, pageUrl: string }`.

## Settings & Storage

Using `chrome.storage.local`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sellerCountry` | number | 26 | Cardmarket seller country filter |
| `languageFilter` | string | "1,8" | Comma-separated language IDs |
| `scryfallSets` | array | null | Cached set list (only `code` and `name` fields per set, ~60-90KB) |
| `scryfallSetsCachedAt` | number | 0 | Timestamp of last set list fetch |

## Error Handling

- **Card not found (404):** Display "No card found for {set} #{number}."
- **Network error:** Display "Network error. Check your connection and try again."
- **Set detection failed:** Display "Could not detect set from this page. Use manual search." with a button to switch to manual mode.
- **Set name not matched:** Display "Could not match set '{name}' to Scryfall. Use manual search."

## File Structure

```
hglistplugin/
  manifest.json
  background.js
  content.js
  sidepanel.html
  sidepanel.js
  sidepanel.css
  icons/
    icon16.png
    icon32.png
    icon48.png
    icon128.png
  docs/
    superpowers/
      specs/
        2026-03-25-cardmarket-lookup-extension-design.md
```

## Technical Decisions

- **Manifest V3** — Required for modern Chrome extensions.
- **No build step** — Vanilla HTML/CSS/JS. No bundler, no framework.
- **No external dependencies** — All logic is self-contained.
- **Side Panel API** — `chrome.sidePanel` (Chrome 114+). Persistent, no popup needed.
- **On-demand detection** — Content script only scrapes when explicitly asked, not on every navigation.
- **24h set cache** — Scryfall set list cached locally to avoid repeated fetches.

## Permissions Required

```json
{
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
  ]
}
```

## Styling

Minimal, clean UI:
- Light background, system font stack
- Clear visual hierarchy: section headers, input fields, result cards
- Responsive to side panel width (~400px typical)
- No external CSS frameworks
