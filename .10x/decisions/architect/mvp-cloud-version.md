# mvp-cloud-version — Architect

See ADR-007 and the spec for the full design. Summary:

## Components (server/)
- `http/`: Hono app, auth middleware (session → userId), API routes, static panel.
- `auth/`: invites, login tokens (hashed, 10 min, one-time), sessions (hashed, 30 days sliding).
- `scheduler/`: 30 s tick, due-watch selection, global token-bucket rate limiter, identical-query fan-out, Vinted backoff state.
- `vinted/`: Node transport implementing the core adapter's transport interface (session bootstrap via GET www.vinted.pl, refresh on 401/403, 20 s timeout, optional proxy).
- `notify/`: `Channel` interface `{ send(user, notification) }`; TelegramChannel, later DiscordWebhookChannel.
- `bot/`: grammY long polling. Commands: /start, /panel, /lista, /pauza, /wznow, /zaproszenie (admin). Callback buttons Hide/Open.
- `db/`: better-sqlite3, numbered SQL migrations, repositories that implement the same interfaces `core/checkWatch` already depends on (OfferRepo, WatchRepo, PriceRepo, ScanLogRepo, SiteHealthRepo), scoped by userId.

## Boundaries
- `packages/core` has no Node, browser or chrome dependencies. It contains pure logic, zod schemas, and building Vinted requests and parsing responses (no I/O).
- I/O lives only in `extension/` (chrome APIs) and `server/` (Node).

## Failure modes
| Failure | Behaviour |
|---|---|
| Vinted IP block (403/429 streak, challenge HTML) | global backoff 5 min→2 h, one admin alert, status in panel |
| Telegram 403 (bot blocked) | channel disabled + reason shown |
| Process crash/restart | watches become due again; dedup prevents re-notify |
| One watch throws | caught per watch, scan recorded with APP-UNKNOWN, scheduler continues |
| Disk loss | nightly SQLite backup |
