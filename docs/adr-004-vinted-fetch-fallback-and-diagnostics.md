# ADR-004: Vinted fetch fallback and scan diagnostics

## Status

Accepted, 2026-10-01. Extends ADR-003.

## Context

Field testing of ADR-003's adapter showed "Vinted: problem z pobieraniem" with
no way to tell why. Two differences from the reference client
(Fuyucch1/Vinted-Notifications) explain the likely failures:

- The reference client sends requests the way a browser on vinted.pl does:
  browser headers (`default_headers`: Accept, Accept-Language, real UA), no
  `Origin`, and session cookies from a plain page load, refreshed and retried
  on 401/404. A `fetch()` from an MV3 service worker instead carries
  `Origin: chrome-extension://<id>` and no Referer, which Vinted's anti-bot
  layer is likely to refuse (403, or a 200 HTML challenge page).
- When Vinted blocks a client, the reference client's only fix is new cookies
  or a different proxy. An extension has a better option: an open vinted.pl tab
  is a real, already-trusted browsing session.

The sandbox still can't reach vinted.pl, so the exact failure couldn't be
reproduced. That's why diagnostics are part of this change and not a
follow-up.

## Decision

**Fetching** (`extension/src/adapters/vinted/`):

- Browser-like request headers: `Accept: application/json, text/plain, */*`
  (what Vinted's web app sends to this API) and a Polish `Accept-Language`.
- A `declarativeNetRequest` session rule (`background/vintedHeaders.ts`)
  removes `Origin` and sets `Referer: https://www.vinted.pl/` on requests to
  vinted.pl that come from outside any tab (`tabIds: [-1]`), i.e. only the
  extension's own service-worker requests. Permission:
  `declarativeNetRequestWithHostAccess`, which adds no install warning.
- Session refresh on 401/404 now uses a full `GET /` instead of `HEAD /`, so the
  anti-bot cookie gets set too, still up to 3 attempts as in the reference.
- **Tab fallback:** if the service worker is refused (401, 403, a non-JSON
  body, a network error or a timeout), the same request runs inside an open,
  loaded `www.vinted.pl` tab via `chrome.scripting.executeScript`. That makes it
  a same-origin request with the page's own cookies. Once the tab works, it is
  tried first until it stops working. The extension never opens a tab on its own.
  Rate limiting (429) and 5xx are not retried through the tab. Permission:
  `scripting`.
- Each request has a 20-second timeout.

**Diagnostics:**

- Stable error codes (`SCAN_ERROR_CODES` in `shared/schemas.ts`): `VNT-401`,
  `VNT-403`, `VNT-404`, `VNT-429`, `VNT-5XX`, `VNT-HTTP`, `VNT-NET`,
  `VNT-TIMEOUT`, `VNT-JSON`, `VNT-SHAPE`, `VNT-EMPTY`, `APP-UNKNOWN`. Each one
  has a Polish title and a hint in `copy.pl.ts`. Don't change what an existing
  code means. Add a new code instead.
- Adapters report every HTTP request (`RequestTrace`): URL, transport
  (`sw`/`tab`), attempt, status, duration, item count, error code, the first
  300 characters of a failed response, and a note.
- Every watch check and every manual connection test writes a `ScanRecord`
  (counts fetched/matched/new, duration, error code and message, requests) to a
  100-entry ring buffer in `chrome.storage.local` (`scans`). The periodic
  health check only writes a record when it fails, so it doesn't push out real
  scans.
- `SiteHealth` keeps the last error's code, message and time. The popup, the
  watch detail page, the sidebar and settings show the code next to "problem z
  pobieraniem".
- A new **Diagnostyka** options screen shows:
  - connection state and the last error with its hint, and a **Test
    połączenia** button;
  - environment: extension version, whether the Vinted session cookie
    `access_token_web` exists, the names of vinted.pl cookies (never their
    values), the number of open Vinted tabs, and whether the header rule is
    active. Permission: `cookies`;
  - the filterable scan log with expandable per-request details;
  - the technical log;
  - **Kopiuj raport**, which copies JSON with the environment, health, the 20
    latest scans and warnings/errors, for bug reports.

## Consequences

- If Vinted blocks the service worker, scanning keeps working as long as the user
  has a vinted.pl tab open. The diagnostics screen says so (`VNT-403` + hint).
- Three new permissions. `scripting` and `cookies` are covered by the existing
  vinted.pl host permission, and none of the three adds a new install warning
  category.
- `chrome.storage.local` grows by at most about 100 scan records (each with
  trimmed snippets).
- Verified in Chromium with mocked vinted.pl responses (service-worker request
  → 403, in-tab request → JSON). Behaviour against the real site still has to
  be confirmed by a user. The diagnostics report is how that result will
  come back.

## Update 2026-10-01: first field report

A user's diagnostics report showed the service worker getting 401 and 404 from
`/api/v2/catalog/items`, where the 404 was an HTML "La page n'existe pas" page.
The browser did hold `access_token_web`, `datadome` and the other Vinted
cookies, and the session refresh didn't help. The reference client treats 401
and 404 alike as "session invalid". Two things kept the tab fallback from
helping:

- `VNT-404` wasn't a fallback trigger. It is now.
- The tab had to report `status === "complete"`, which Vinted's pages often
  never do. Any tab that isn't discarded can be used now, and a fully loaded
  one is still preferred.

The "tab first" preference now lives in `chrome.storage.session`. It survives
service-worker restarts, so a blocked setup doesn't spend 3 failing
service-worker attempts and 2 home-page loads on every scan.
