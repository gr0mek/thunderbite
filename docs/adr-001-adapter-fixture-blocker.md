# ADR-001: OLX/Vinted/Allegro adapters blocked on real fixtures

## Status

Superseded for Vinted by ADR-003 (OLX/Allegro dropped by ADR-002).

## Context

`startSmartBuy.md` §6 rule 3 is explicit: **must not** invent endpoints, CSS
selectors, or JSON response shapes for the three marketplaces. Real
responses must be saved to `extension/tests/fixtures/` first, and parsers
written against them.

The implementation environment's network egress policy blocks
`allegro.pl`, `developer.allegro.pl`, `olx.pl`, and `vinted.pl` outright
(403 at the proxy/gateway level — confirmed via direct `curl`, not a
transient failure). `fonts.googleapis.com` and the npm registry are
reachable, so this is a scoped allowlist, not a general outage.

## Decision

Everything else in the MVP was built against the `SiteAdapter` interface
(`extension/src/adapters/types.ts`) and a clearly-labeled fake adapter
(`extension/src/adapters/fake/`) that returns caller-supplied data — never
data shaped to imitate a real marketplace response. The background service
worker (`extension/src/background/index.ts`) wires the fake adapters in for
now, with a `TODO(#6-#8)` marking exactly where the real ones plug in.

Building the real adapters requires one of:

1. Network access to `olx.pl`, `vinted.pl`, `allegro.pl`, and
   `developer.allegro.pl` from the build environment, or
2. The user supplying real fixtures directly — a saved search-results page
   (HTML) from OLX/Vinted, and either a saved Allegro API response or the
   relevant pages of Allegro's official REST API docs (endpoint, auth flow,
   response schema) for the offer-search endpoint.

## Consequences

- The app is fully wired end-to-end (storage → scheduler → matcher → dedup
  → notifications → UI) and testable today, but finds no real offers until
  the three adapters land.
- Allegro's actual rate limits are unknown without the docs, so
  `SiteRateLimiter`'s per-site `minIntervalMs` for Allegro is a placeholder
  the real adapter must set correctly once the docs are available (§6 rule
  10 requires respecting the site's real limit regardless of source).
- Vinted's fetch strategy (session-cookie fetch from the service worker vs.
  a content-script fallback in a Vinted tab, per §6 rule 14) can't be
  determined without inspecting real request/response behavior, so that
  decision is deferred to when the adapter is actually built.
