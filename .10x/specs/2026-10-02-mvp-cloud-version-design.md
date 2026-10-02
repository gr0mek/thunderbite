# mvp-cloud-version — design

**Date:** 2026-10-02 · **Status:** Approved by user · **ADR:** `docs/adr-007-cloud-server.md`

## Problem

Thunder Bait runs entirely inside a Chrome extension: scheduling, matching,
dedup, deal mode and storage all live in the browser. Monitoring stops when the
browser is closed. The user wants it to run in the cloud, for themselves and a
few friends, with notifications on Telegram (and later Discord).

## Decisions taken in brainstorming

| Topic | Decision |
|---|---|
| Audience | The user plus a few friends. Invite-only; each person has their own watches, offers and channels. No public sign-up. |
| Interface | Web panel + Telegram bot. Login through the bot. The bot also has a few commands. |
| Channels | Telegram in the MVP. Discord (webhook) in stage 5, behind the same `Channel` interface. |
| Hosting | One Docker container on a cheap VPS (about 4–6 €/month). Plan B: the same image on a home Raspberry Pi/NAS, or the VPS behind a residential proxy. The stage-0 access test decides. |
| Extension | Stays as it is and keeps working on its own. Shared code moves to a workspace package. No sync between extension and server in the MVP. |
| Approach | A: a TypeScript monolith. Alternatives B (Supabase + worker) and C (fork Vinted-Notifications) were rejected; see the ADR. |

## Architecture

```
VPS (docker-compose)
├─ caddy            HTTPS termination, automatic certificate → server:3000
└─ server (Node 22, one process)
   ├─ http          Hono: /api/* (JSON, session cookie) + static Preact panel
   ├─ auth          invite codes, one-time login links from the bot, sessions
   ├─ scheduler     30 s tick → due watches → queue with a global Vinted rate limit
   ├─ vinted        adapter: core parser + Node transport (session token, retries, optional proxy)
   ├─ notify        Channel interface: TelegramChannel (MVP), DiscordWebhookChannel (stage 5)
   ├─ bot           grammY, long polling: /start, /lista, /pauza, /wznow, inline buttons
   └─ db            SQLite (better-sqlite3) on a volume, versioned migrations
```

Repository layout after stage 1 (npm workspaces at the repo root):

```
packages/core/   matcher, market, checkWatch, schemas (zod), Vinted request building + parsing, scan error codes
extension/       unchanged behaviour, imports @thunderbait/core
server/          the cloud app (server + panel)
backend/         existing Supabase email functions, untouched
```

## Data flow

1. Every 30 s the scheduler picks active watches whose `next_check_at` has passed. The minimum interval is 5 min, or 2 min for deal mode, the same limits as the extension.
2. Each watch goes into a queue with a **global** Vinted rate limit (default: one request every 3 s, configurable). The limit is shared by all users.
3. Identical Vinted queries from different watches within one tick are fetched once, and the result fans out to every watch.
4. `checkWatch` from core runs:
   - keyword and exclusion filter;
   - dedup by `vinted:<externalId>` per watch;
   - price history and the deal-mode median;
   - the silent baseline on the first run.
5. New matches go to every enabled channel of the watch owner. On Telegram that is a photo, title, price, deal discount, a link, and Hide/Open buttons.

## Data model (SQLite)

```
users(id, telegram_id UNIQUE, display_name, is_admin, created_at)
invites(code PK, created_by → users, used_by → users NULL, expires_at)
login_tokens(token_hash PK, user_id, expires_at, used_at)      -- one-time, 10 min
sessions(id_hash PK, user_id, expires_at, created_at)          -- 30 days, sliding
channels(id, user_id, kind CHECK IN ('telegram','discord'), target, enabled, disabled_reason)
watches(id, user_id, <fields of WatchSchema>, next_check_at, created_at)
offers(watch_id, external_id, user_id, title, price, url, image_url, deal_kind,
       state CHECK IN ('new','seen','hidden'), first_seen_at, PRIMARY KEY(watch_id, external_id))
prices(watch_id, external_id, price, seen_at, PRIMARY KEY(watch_id, external_id))
scans(id, watch_id NULL, user_id NULL, started_at, duration_ms, status, error_code, counts_json, requests_json)
vinted_health(id = 1, status, last_error_code, last_error_at, blocked_until)
```

- Indexes:
  - `watches(next_check_at)` where active;
  - `offers(user_id, state, first_seen_at)`;
  - `prices(watch_id, seen_at)`.
- Retention:
  - offers: 30 days;
  - prices: 30 days;
  - scans: the last 500 rows;
  - expired sessions and login tokens are purged by an hourly housekeeping job.
- Every repository method that reads or writes user data takes a `userId` and filters on it.
- Limits: `WATCH_LIMIT = 20` per user, unchanged.

## Error handling and Vinted blocking

- **Error codes:** the existing scan error codes (`VNT-*`, `APP-*`) are reused unchanged. The panel's Diagnostics screen shows them in the same way as the extension does.
- **Vinted session:** one server-wide session (`access_token_web`, `anon_id`) held in memory.
  - It is obtained with `GET https://www.vinted.pl/` and browser-like headers.
  - On 401/403 the session is refreshed and the request retried, at most 3 attempts.
- **Blocking:** five 403/429 responses in a row, or any challenge HTML, count as an IP block. Then:
  - global exponential backoff, from 5 min up to 2 h, stored in `vinted_health.blocked_until`;
  - **one** Telegram message to admins when the block starts and one when it ends;
  - every user's panel shows "problem z pobieraniem" with the code.
- **Proxy:** `VINTED_PROXY_URL` (optional) routes every Vinted request through an HTTP(S) proxy. Plan B therefore needs no code change.
- **Telegram channel errors:**
  - 403 "bot was blocked" or "chat not found" disables the channel and records `disabled_reason`;
  - 429 respects `retry_after`;
  - other errors retry 3 times, then the notification is dropped and logged.
- **Crash safety:** unhandled errors in one watch never stop the scheduler. On restart, watches simply become due again, and dedup prevents double notifications.

## Security

- **Invite-only access:**
  - an admin creates invite codes with the bot command `/zaproszenie`;
  - a new user sends `/start <code>` to the bot, which creates the account bound to their Telegram id.
- **Login:**
  - `/panel` in the bot returns a one-time link (random 32-byte token, stored hashed, valid 10 min);
  - opening the link exchanges it for a session cookie: `HttpOnly; Secure; SameSite=Lax`, random id stored hashed.
- **Authorization:** each API handler resolves `userId` from the session, and every query filters by it. A test proves that user A can neither read nor modify user B's watches, offers or channels.
- **Input validation:** all API input is validated with the shared zod schemas. Interval minimums are enforced on the server.
- **Rate limits:** on the login-link exchange (per IP) and on API writes (per user).
- **Secrets:** `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` and `VINTED_PROXY_URL` come from environment variables or a `.env` file that is not committed.
- **Transport and exposure:** Caddy provides HTTPS. The server binds only to the compose network.
- **Privacy:** the server stores Telegram ids and display names only. No email or passwords.

## Testing

- `packages/core`: the existing extension tests move with the code and must stay green. The extension's CI stays green.
- `server`, all with vitest:
  - Vinted adapter against fixtures that mock svc-catalogue: success, 401 then refresh, 403 block, 429, HTML challenge, timeout;
  - repositories on in-memory SQLite;
  - API: auth flow and cross-user isolation;
  - scheduler: due selection, shared-query fan-out, backoff;
  - Telegram channel with a mocked Bot API: success, blocked bot, 429.
- CI: a new `server-ci` workflow (format, lint, typecheck, test, docker build).

## Delivery plan

| Stage | Scope | Done when |
|---|---|---|
| 0 | `server/scripts/vinted-probe.ts`: polls svc-catalogue every 5 min for 24 h from the target host and records status codes and timings | The user runs it on the VPS. Result: VPS OK, or plan B |
| 1 | npm workspaces + `packages/core` extracted; the extension imports it | The extension's build, tests and CI pass unchanged |
| 2 | Server: SQLite + migrations, scheduler, Node Vinted transport, Telegram channel, bot with invites/login/watch commands | Watches added through the bot produce Telegram notifications on a local run |
| 3 | Web panel: watches CRUD, offers, deal mode, diagnostics; screens ported from `extension/src/ui/options` | Full MVP on a local run |
| 4 | Dockerfile, docker-compose with Caddy, nightly SQLite backup (`sqlite3 .backup`), deploy README | Running on the VPS; friends invited |
| 5 | Discord webhook channel | A user can add a Discord webhook in the panel |

## Out of scope for the MVP

- Public sign-up, payments, email notifications from the server (the Supabase email backend stays as it is).
- Syncing watches between the extension and the server.
- Other marketplaces.
- Horizontal scaling. A single process is enough for a few users.
