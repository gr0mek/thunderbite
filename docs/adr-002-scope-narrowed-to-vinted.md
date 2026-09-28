# ADR-002: Scope narrowed to Vinted only

## Status

Accepted, 2026-09-22.

## Context

The MVP was designed and built against three marketplaces (OLX, Vinted,
Allegro) — see ADR-001 for why none of the three adapters could be built
against real fixtures. The user decided to drop OLX and Allegro from the
product and focus the extension entirely on Vinted.

## Decision

- `SiteId` (`extension/src/adapters/types.ts`) is now the single literal
  type `"vinted"` instead of a three-way union. Everywhere that iterated
  over all sites (`rateLimiter.ts`, `healthcheck.ts`, `siteHealthRepo.ts`,
  `watchRepo.ts`'s default-sites fallback, the background service worker's
  adapter map) now only knows about Vinted.
- `manifest.config.ts`'s `SITE_HOSTS`, its `host_permissions`, and its
  `content_scripts` match pattern were narrowed to `vinted.pl`/`vinted.com`.
  The extension no longer requests host permissions for `olx.pl` or
  `allegro.pl`.
- The now-meaningless "pick which sites to search" UI was removed rather
  than left as a disabled single-option control: the site toggle in
  `NewWatchForm` and the site filter dropdown in the options `OffersScreen`
  are both gone. `Watch.sites` still exists as a schema field (an array of
  one), so a second site can be reintroduced later without a schema
  migration.
- All user-facing copy in `copy.pl.ts` that named OLX/Vinted/Allegro
  together now names only Vinted (onboarding pitch, empty-state "checking"
  copy, `siteNames`/`siteInitial`).
- The empty `src/adapters/olx/`, `src/adapters/allegro/`,
  `tests/fixtures/olx/`, and `tests/fixtures/allegro/` placeholder
  directories were deleted. `src/adapters/vinted/` remains empty — the real
  Vinted adapter is still blocked on ADR-001's fixture/network constraint,
  independent of this scope change.
- Backlog tasks for the OLX and Allegro adapters were dropped; the Vinted
  adapter task is unchanged.

## Consequences

- Less surface area: one adapter to build, one site's rate limit/health to
  track, simpler forms and filters.
- `SiteAdapter`/`SearchQuery`/`NormalizedOffer` and the per-site plumbing
  (`SiteRateLimiter`, `SiteHealthRepo`) are still written generically over
  `SiteId`, so re-adding a second site later is a type-union change plus
  restoring the removed UI controls, not an architecture change.
- The real Vinted adapter is **still** unbuilt — this ADR only removes OLX
  and Allegro from scope; it does not unblock ADR-001's network/fixture
  constraint for Vinted itself.
