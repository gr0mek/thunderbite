# Thunder Bait backend

Four Supabase Edge Functions that deliver email — nothing else. All
scheduling, matching, and dedup happen in the extension; this only ever
sees what a single send needs (startSmartBuy.md §6 rule 18).

**Not deployed or tested.** This sandbox's network egress policy blocks
`supabase.com` and `api.resend.com`, and no `supabase`/`deno` CLI is
installed here, so none of this has been run — see
`../docs/adr-001-adapter-fixture-blocker.md` for the same constraint as it
applies to the marketplace adapters. The code follows the standard,
documented Supabase Edge Functions + Resend integration patterns, but
please deploy to a real (or local `supabase start`) project and exercise
each endpoint before relying on it.

## Functions

| Function | Method | Purpose |
|---|---|---|
| `request-verification` | POST `{ email }` | Upserts a pending subscriber, emails a one-time confirmation link. |
| `confirm-email` | GET `?token=` | Marks a subscriber verified. |
| `send-email` | POST `{ email, kind, ... }` | Sends `immediate` / `daily` / `problem` email — only to a `verified` subscriber. |
| `unsubscribe` | GET `?token=` | Marks a subscriber unsubscribed (one-time link, no login — uxSmartBuy.md §5.6). |

No user accounts: `subscribers` (see `supabase/migrations/0001_subscribers.sql`)
is keyed by email with two opaque tokens, not a Supabase Auth user.

## Deploying

```sh
cd backend
supabase link --project-ref <project-ref>
supabase db push                        # runs migrations/0001_subscribers.sql
supabase secrets set \
  RESEND_API_KEY=re_... \
  RESEND_FROM="Thunder Bait <notifications@yourdomain.com>" \
  FUNCTIONS_BASE_URL=https://<project-ref>.functions.supabase.co \
  SETTINGS_URL=chrome-extension://<extension-id>/src/ui/options/index.html#/settings
supabase functions deploy request-verification confirm-email send-email unsubscribe
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` don't need setting — Supabase
injects those into every function automatically.

Then point the extension at it: copy `extension/.env.example` to
`extension/.env` and set `VITE_SUPABASE_FUNCTIONS_URL` to
`https://<project-ref>.functions.supabase.co/functions/v1`.

## Known gaps (MVP-scoped, flagging rather than guessing)

- **No rate limiting** on `request-verification` / `send-email` beyond
  Resend's own account limits. Fine for personal/small-scale use per
  `startSmartBuy.md`'s "użytek prywatny" framing in §11's open questions;
  add a `resend_at` cooldown column before any public rollout.
