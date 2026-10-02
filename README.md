# Thunder Bait

Open-source deal monitor: a Chrome MV3 extension that watches Vinted and
eBay (ebay.com) for offers matching your saved searches and notifies you
(browser + email) when one shows up.

Originally scoped for OLX, Vinted and Allegro, then narrowed to Vinted
(`docs/adr-002-scope-narrowed-to-vinted.md`); eBay was added on its official
Browse API (`docs/adr-007-ebay-adapter.md`).

## Layout

- `extension/` — the Chrome extension itself (Preact + Vite + TS). See
  `extension/README.md` for setup, dev commands, and manual QA.
- `backend/` — Supabase Edge Functions that send email notifications. See
  `backend/README.md` for deployment.
- `docs/` — architecture decision records (`adr-*.md`).

## Status

MVP: storage, scheduler, matcher/dedup, notifications, the full popup +
options UI, and the real Vinted adapter (catalog API, modelled on
[Vinted-Notifications](https://github.com/Fuyucch1/Vinted-Notifications)) —
see `docs/adr-003-vinted-adapter.md`. If scanning fails, the options page's
**Diagnostyka** screen shows the scan log with error codes and can copy a
report; see `docs/adr-004-vinted-fetch-fallback-and-diagnostics.md`. Vinted's
September 2026 move to `api.vinted.pl/svc-catalogue` is covered in
`docs/adr-005-vinted-svc-catalogue-api.md`.

eBay needs your own free API keyset: options page → Ustawienia → "eBay —
klucz API" has a short how-to (developer.ebay.com → Application Keys →
Production keyset). Prices are in USD, only listings that ship to Poland are
shown, auctions are marked "Licytacja", and shipping is shown next to the
price — see `docs/adr-007-ebay-adapter.md`.

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
