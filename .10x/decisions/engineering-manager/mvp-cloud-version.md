# mvp-cloud-version — Engineering Manager

Tasks are ≤ half a day. Each stage ends green in CI and is pushed to PR #6, or to its own PR if the user prefers.

## Stage 0 — Vinted access probe (ships first, independent)
- 0.1 `server/scripts/vinted-probe.ts` + minimal `server/package.json`, run with `npx tsx`: bootstrap the session, query svc-catalogue every 5 min, print a JSON line per attempt (status, ms, items, code), a summary on exit. ~2 h
- 0.2 README section with how to run it on the VPS (`nohup`/`tmux`, 24 h) and how to read the result. ~0.5 h
- **Gate:** the user runs it on the target VPS and reports. A block decides plan B before stage 4.

## Stage 1 — packages/core (~1.5 days)
- 1.1 Root npm workspaces; move ESLint/Prettier/tsconfig base to the root; extension CI uses the root install.
- 1.2 Move interfaces that core depends on (Notifier, SiteRateLimiter, the repo interfaces, Logger, DiagnosticsEnvironment) into core as types; the extension implements them.
- 1.3 Move `core/*`, `shared/schemas.ts`, `shared/scanErrors.ts`, `adapters/types.ts`, `adapters/searchContext.ts`, `adapters/vinted/api.ts` + the transport-agnostic part of `adapters/vinted/index.ts` into `packages/core`; move their tests.
- 1.4 Extension imports `@thunderbait/core`; build, 86 tests and CI green; manual smoke check of the extension build.

## Stage 2 — server core (~4 days)
- 2.1 Skeleton: `server/` package, `config.ts` (zod env), JSON logger, vitest, `server-ci` workflow.
- 2.2 SQLite: migrations runner + 0001 schema; repos implementing core interfaces scoped by userId; tests on `:memory:`.
- 2.3 Node Vinted transport (session bootstrap, refresh, timeout, proxy) + fixture tests.
- 2.4 Scheduler: due selection, token-bucket limiter, query fan-out, backoff + vinted_health; tests with fake clock.
- 2.5 TelegramChannel (sendPhoto/sendMessage, error mapping) + tests with mocked Bot API.
- 2.6 Bot: /start <invite>, /zaproszenie, /lista, /pauza, /wznow, /dodaj (keywords + max price), Hide/Open callbacks.
- 2.7 Wire-up `main.ts`, housekeeping job, local end-to-end run against mocked Vinted.

## Stage 3 — web panel (~3 days)
- 3.1 Hono API: auth (/panel link exchange, sessions, logout), watches CRUD, offers list/state, channels, diagnostics; isolation tests.
- 3.2 Panel build (Vite + Preact) served statically; port Watches, Watch detail (deal panel), Offers, Diagnostics, Settings from `ui/options` with an API data layer instead of chrome messaging.
- 3.3 a11y pass with axe as in the extension's DoD.

## Stage 4 — deploy (~1 day)
- 4.1 Multi-stage Dockerfile (non-root, healthcheck), docker-compose with Caddy, `.env.example`.
- 4.2 Nightly backup job, deploy + restore README, first deploy with the user.

## Stage 5 — Discord (~0.5 day)
- 5.1 DiscordWebhookChannel + panel form + tests.

## Risks
- Vinted blocks the VPS (stage 0 decides; plan B is configuration only).
- Stage 1 churn could break the extension. Mitigation: it is one isolated PR with CI as the gate.
- Telegram's Login Widget is not used, so a domain is not required before stage 4; login is via bot links.
