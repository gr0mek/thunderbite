# Architect — index

Active features: `chrome-extension`, `mvp-cloud-version`.

## Cross-cutting [DISCOVERED]
- Layered extension: `adapters/` (SiteAdapter contract) → `core/` (checkWatch, matcher, market, watchLifecycle — pure logic with injected repos) → `storage/` (chrome.storage + IndexedDB repos) → `background/` (MV3 service worker: alarms, notifier, rate limiter, DNR header rules) → `ui/` (popup, options, content script).
- `core/` depends only on interfaces (OfferRepo, WatchRepo, Notifier, …), so it is portable to a server runtime.

- `mvp-cloud-version`: server monolith (ADR-007); core extracted to `packages/core` so extension and server share logic.
