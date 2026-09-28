# ADR-003: Vinted adapter built on the Vinted-Notifications client

## Status

Accepted, 2026-09-28. Supersedes the Vinted part of ADR-001.

## Context

ADR-001 blocked the real adapter because `vinted.pl` is unreachable from the
build environment (still true: proxy 403) and endpoints/response shapes must
not be invented. The open-source project
[Fuyucch1/Vinted-Notifications](https://github.com/Fuyucch1/Vinted-Notifications)
has a small, actively used Python client (`pyVintedVN/`) for exactly this job,
which documents the working request and response contract. We use it as the
source of truth instead of a captured fixture.

What the reference client does:

- **Endpoint:** `GET https://<host>/api/v2/catalog/items` with the search
  page's query params — `search_text`, `price_from`, `price_to`,
  `status_ids`, `brand_ids`, `catalog_ids`, `size_ids`, … — plus `page`,
  `per_page` (default 20) and `order`. Every saved query is forced to
  `order=newest_first` (`core.process_query`).
- **Session:** anonymous; no login. It loads the site root (`HEAD /`) to
  receive session cookies and, on a 401/404 from the API, refreshes cookies
  and retries (max 3 attempts, `Requester.get`).
- **Item fields read:** `id`, `title`, `url`, `brand_title`, `size_title`,
  `price.amount` + `price.currency_code`, `photo.url`, and
  `photo.high_resolution.timestamp` as the listing time.
- **New-item detection:** newest-first polling plus a per-query "last seen
  timestamp". Thunder Bait already dedupes by `vinted:<id>` in IndexedDB
  with a silent baseline run, which is stricter, so the timestamp trick is
  not ported.
- **Polling:** all queries back-to-back once a minute by default.

## Decision

- `extension/src/adapters/vinted/` implements `SiteAdapter` against that
  contract on `www.vinted.pl`. Requests run in the service worker with
  `credentials: "include"`; `host_permissions` for `*.vinted.pl` make the
  browser's own Vinted cookies apply, so a user who has visited Vinted is
  already authenticated, and a 401/404 triggers one `HEAD /` refresh per
  retry, as in the reference.
- A watch's keywords are OR-ed, but `search_text` is one phrase, so the
  adapter issues one request per keyword (1.5 s apart) and merges by id.
  The core matcher still does the final keyword/exclusion/price filtering.
- Mapped filters: price → `price_from`/`price_to`; condition "Nowy" →
  `status_ids=6,1`, "Używany" → `status_ids=2,3,4`. Location and the
  free-text size are not sent (Vinted wants numeric `city_ids`/`size_ids`).
- Parsing is lenient (Zod with passthrough): price may be an object or a
  string, relative URLs are resolved, and a malformed item is dropped
  rather than failing the whole page. A response without `items` fails.
- `minIntervalMs` is 5 s between any two Vinted searches — gentler than the
  reference's back-to-back polling, and short enough for the rate
  limiter's in-memory wait to fit an MV3 service worker's lifetime.
- `healthCheck()` requests the 5 newest listings (empty `search_text`):
  `ok` with usable items, `degraded` if empty, `broken` on HTTP errors.
- F3 quick-add: `detectSearchContext` reads `search_text` and `price_to`
  from `/catalog` URLs — the same params the API takes.

## Consequences

- The extension now finds real offers. The test fixture
  (`tests/fixtures/vinted/catalog-items.json`) is hand-written to the fields
  above, not captured — replace it with a real response when one is
  available, and check the adapter against it.
- If Vinted puts the API behind stronger bot protection (e.g. 403
  challenges), the site health goes `broken` and the UI's existing banner
  shows it; the fallback would be fetching from a content script in an open
  Vinted tab (§6 rule 14), not implemented yet.
- Vinted is an SPA; the quick-add content script only reads the URL at page
  load, so in-app navigation to a new search isn't re-detected until reload.
