# ADR-007: Cloud server as a TypeScript monolith

## Status

Accepted, 2026-10-02. Feature `mvp-cloud-version`; full design in
`.10x/specs/2026-10-02-mvp-cloud-version-design.md`.

## Context

Everything Thunder Bait does happens in the Chrome extension, so monitoring
stops whenever the browser is closed. The user wants the app to run in the
cloud for themselves and a few invited friends:

- per-user watches;
- a web panel;
- Telegram notifications in the MVP and Discord later.

Constraints:

- **Budget:** a few euros a month.
- **Maintainer:** one person.
- **Reuse:** the existing TypeScript code should be reused, mainly `core/`
  (matcher, market, checkWatch) and the Vinted request/response handling from
  ADR-005.
- **Vinted access:** the main technical risk. `api.vinted.pl` sits behind
  DataDome, and datacenter IPs are blocked more often than home connections.
  Server access has not been verified yet.

## Decision

- **One Node 22 process in one Docker container on a VPS**, behind Caddy for HTTPS. It contains:
  - the Hono HTTP API and the static Preact panel;
  - a scheduler with a global Vinted rate limit and fan-out of identical queries;
  - a Node Vinted transport (server-wide session, refresh on 401/403, optional `VINTED_PROXY_URL`);
  - a grammY Telegram bot in long-polling mode, used for invites, login links, commands and notifications;
  - SQLite (better-sqlite3) on a volume.
- **Notification channels** sit behind a `Channel` interface. Telegram ships in the MVP, a Discord webhook follows.
- **Shared code** moves to `packages/core` in npm workspaces, and both the extension and the server import it. The extension keeps working on its own, with no sync.
- **Stage 0, before any server code:** a 24-hour probe of svc-catalogue from the target VPS. If it gets blocked, the same image runs on a home device or through a residential proxy (plan B, configuration only).

## Alternatives considered

| Alternative | Pros | Cons | Why not |
|---|---|---|---|
| B: Supabase (Postgres + Auth) + a worker on a VPS | Managed DB and backups; Supabase already used for email | Three deploy targets (DB, panel host, worker); free tier pauses after 7 days idle; Supabase Auth has no Telegram login | More moving parts than a few users need |
| B': Supabase only (pg_cron + Edge Functions) | No server to run | Requests leave shared cloud IPs that anti-bot systems often block; execution-time limits | Highest blocking risk; plan B impossible |
| C: Fork Fuyucch1/Vinted-Notifications (Python) | Bot and web UI already exist | Different language, single user, no deal mode, exclusions or diagnostics; two products to maintain | Loses most of Thunder Bait's value |
| Extension as the panel, syncing to the cloud | Reuses the existing UI as is | Every friend must install the extension; two sources of truth | Sync complexity for no MVP benefit |

## Consequences

### Positive

- Monitoring no longer needs an open browser. Friends need nothing but Telegram and a link.
- One artifact to build, deploy and back up. It runs on a VPS or a Raspberry Pi without changes.
- Matching, deal mode and the error codes stay identical in the extension and on the server.

### Negative

- Single point of failure. A VPS outage stops scanning for everyone (acceptable at this scale).
- All users share one IP and one Vinted session. Heavy use by one person can get everyone blocked. Interval minimums and the global rate limit are enforced on the server for that reason.
- npm workspaces change the extension's install and CI paths in stage 1.

### Risks

- **Vinted blocks the VPS IP:** the stage-0 probe finds this before we build. Mitigations are plan B, backoff, and a single admin alert.
- **Vinted changes its API again (as in ADR-005):** request building and parsing live in one place in `packages/core`, with fixtures, so one fix covers both apps.
- **SQLite file loss:** a nightly `.backup` copy off the volume.

## Dependencies

- Depends on ADR-005 (svc-catalogue contract) and ADR-006 (deal mode).
- Constrains later work:
  - a public, multi-tenant version would need a new ADR (Postgres, real auth, scaling);
  - email from the server would reuse or replace `backend/`.
