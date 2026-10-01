# ADR-005: Vinted catalogue moved to svc-catalogue (September 2026)

## Status

Accepted, 2026-10-01. Supersedes the endpoint and auth parts of ADR-003, and
the "404 is a session problem" handling added to ADR-004.

## Context

A field diagnostics report (ADR-004's "Kopiuj raport") showed
`www.vinted.pl/api/v2/catalog/items` answering with an HTML 404 page ("La
page n'existe pas") for every request. That included same-origin requests
from an open vinted.pl tab with valid session cookies. So this was not a
session or anti-bot problem.

In September 2026 Vinted retired that endpoint. The catalogue moved to a
dedicated host behind a bearer token. Several open-source clients published
the same migration. We follow the one for the reference project,
[mariostavrou83-create/Vinted-Notifications#1](https://github.com/mariostavrou83-create/Vinted-Notifications/pull/1)
("Fix Vinted catalogue access with the September 2026 API"). Two others
describe it the same way:
[HelpCode-ai/anythingmcp#710](https://github.com/HelpCode-ai/anythingmcp/pull/710)
and
[stevehaigh/vinted-scanner#9](https://github.com/stevehaigh/vinted-scanner/pull/9).

## Decision

- **Endpoint:** `GET https://api.vinted.pl/svc-catalogue/items` with
  `search_text`, `order=newest_first`, `page`, `per_page`, `price_from` and
  `price_to`.
- **Condition filter:** now `attribute_ids[status]` (was `status_ids`). The ids
  are unchanged: new = `6,1`, used = `2,3,4`. The old names are silently ignored
  rather than rejected, so getting this wrong would return unfiltered results.
- **Empty filters are omitted.** svc-catalogue answers 400 to a blank one. The
  health check therefore sends no `search_text` at all.
- **Auth:**
  - `Authorization: Bearer <access_token_web>` and `x-anon-id: <anon_id>`. The
    service worker reads both cookies with `chrome.cookies`, which needs the
    `cookies` permission already added in ADR-004.
  - With no token, the adapter first does `HEAD https://www.vinted.pl/`, which
    hands out both cookies.
  - A 401 or 403 means the token was rejected. The adapter refreshes it the same
    way and retries, up to 3 attempts, as the reference fork does.
- **404 is a real error again** (`VNT-404`: "API not found"). It is not retried
  and doesn't trigger the tab fallback.
- **Header rule:** the declarativeNetRequest rule now *sets* `Origin` to
  `https://www.vinted.pl` instead of removing it, and keeps the vinted.pl
  `Referer`. That's what the website and the reference fork send to
  api.vinted.pl. `requestDomains: ["vinted.pl"]` already covers the api host.
- **Tab fallback** (ADR-004) is kept. The in-tab request now gets the same
  bearer and anon-id headers, because the token cookie may be HttpOnly and the
  page script can't read it.
- **Item parsing** is unchanged. The response still has `items[]` with `id`,
  `title`, `url` (now relative, resolved against www.vinted.pl), `price`
  (`amount` and `currency_code`) and `photo.url`. Listing timestamps are gone,
  so `postedAt` is usually empty. Dedup was already by id.

## Consequences

- Scanning works without an open Vinted tab, as long as the browser holds the
  Vinted session cookies (any visit to vinted.pl sets them, and the adapter
  can fetch them itself).
- Verified in Chromium against a mocked svc-catalogue: the bearer token and
  anon id are sent from the service worker, and the tab fallback still
  works. Not yet verified against the real api.vinted.pl.
