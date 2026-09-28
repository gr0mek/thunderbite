# Thunder Bait

Open-source Vinted deal monitor: a Chrome MV3 extension that watches Vinted
for offers matching your saved searches and notifies you (browser + email)
when one shows up.

Originally scoped for OLX, Vinted and Allegro; narrowed to Vinted only — see
`docs/adr-002-scope-narrowed-to-vinted.md`.

## Layout

- `extension/` — the Chrome extension itself (Preact + Vite + TS). See
  `extension/README.md` for setup, dev commands, and manual QA.
- `backend/` — Supabase Edge Functions that send email notifications. See
  `backend/README.md` for deployment.
- `docs/` — architecture decision records (`adr-*.md`).

## Status

MVP: storage, scheduler, matcher/dedup, notifications, and the full popup +
options UI are built and tested against a fake adapter. The real Vinted
adapter (actual network fetching) is still blocked on fixtures/network
access — see `docs/adr-001-adapter-fixture-blocker.md`.

## Quick start

```sh
cd extension
npm install
npm run dev      # vite dev server with HMR
npm run build     # production build to extension/dist/
npm test
```

Load `extension/dist/` as an unpacked extension via `chrome://extensions`
(Developer mode → Load unpacked) to try it locally.
