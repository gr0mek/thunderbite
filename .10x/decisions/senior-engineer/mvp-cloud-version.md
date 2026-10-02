# mvp-cloud-version — Senior Engineer

## Stage 0
- Reuse request building from the extension: `buildCatalogParams`, `CatalogResponseSchema`, `REQUEST_HEADERS`, `authHeaders`. Stage 1 hasn't run yet, so the probe imports them directly from `../../extension/src/adapters/vinted/*` through a relative path. These files have no chrome dependency at import time (`transport.ts` only touches `chrome` inside functions, guarded by `typeof chrome`).
- Session: `GET https://www.vinted.pl/` with browser-like headers; read `access_token_web` and `anon_id` from `set-cookie` (Node `Headers.getSetCookie()`); send `Authorization: Bearer` + `x-anon-id` + `Origin`/`Referer` www.vinted.pl.
- Classify each attempt with `codeForHttpStatus` / a JSON check so the summary uses the same VNT-* codes as the diagnostics screen.
- Optional `--proxy` via undici `ProxyAgent` to test plan B with the same script.

## Stage 1 tricky parts
- `@/` alias collisions between packages: core uses relative imports only; the extension keeps `@/` for its own files.
- `adapters/vinted/index.ts` mixes transport preference (chrome.storage.session, tab fallback) with request/retry logic. Split it: retry/session logic + parsing go to core and take an injected `fetch` and `readAuth`; the tab fallback and preference stay in the extension.

## Stage 2 tricky parts
- better-sqlite3 is synchronous while core repo interfaces are async. Wrap the calls in resolved promises; that's fine at this scale.
- Fan-out: key identical queries by the serialized `SearchQuery` (keywords sorted, price range, condition, limit). Deal-mode watches ask for no price range, so they share more.
- Telegram: escape MarkdownV2 or use HTML parse mode; titles from Vinted are untrusted text.
- Never put the login token in logs; log only the token hash prefix.

## Stage 3 tricky parts
- The options screens read data through `ui/shared/dataHooks.ts` (chrome messaging). Introduce a `DataSource` interface so the same hooks run against chrome messaging or fetch('/api').
