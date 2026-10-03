# mvp-cloud-version — Staff Engineer

- **Monorepo:** npm workspaces at the repo root: `packages/core`, `extension`, `server`. `backend/` stays outside (Deno).
- **Shared conventions:** TS strict, zod as the source of truth, `@/` alias inside each package, Polish copy in a `copy.pl.ts` (server panel reuses the extension's copy where screens are ported), ESLint + Prettier configs shared from the root.
- **Error codes:** reuse `SCAN_ERROR_CODES`; add new codes, never repurpose. Server-only failures get new `SRV-*` codes if needed.
- **Logging:** structured JSON lines to stdout (level, msg, watchId, userId, code). Never log tokens, cookies or login links.
- **Config:** a single `config.ts` reads env with zod and fails fast on startup.
- **Reuse:**
  - `core/matcher.ts`, `core/market.ts`, `core/checkWatch.ts`, `shared/schemas.ts`, `shared/scanErrors.ts`;
  - the request building and parsing in `adapters/vinted/api.ts` + `index.ts`, with chrome-specific transport split out;
  - `ui/options` screens for the panel.
- **Watch-outs:**
  - `checkWatch` imports `Notifier` and `SiteRateLimiter` types from `background/`; those interfaces move to core;
  - the extension's CI must keep passing after the extraction.
