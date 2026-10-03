# chrome-extension — Architect [DISCOVERED]
- Data flow: chrome.alarms → checkWatch(watch) → VintedAdapter.search → filter/dedup (OfferRepo, `vinted:<id>`) → PriceRepo (deal mode median) → Notifier (chrome.notifications + backend email).
- Vinted access (docs/adr-005): `GET api.vinted.pl/svc-catalogue/items`, bearer `access_token_web` + `x-anon-id` cookies obtained via `HEAD www.vinted.pl`; DNR rule sets Origin/Referer; fallback runs the request inside an open vinted.pl tab (chrome.scripting).
- Browser-only couplings: `adapters/vinted/transport.ts` (chrome.cookies, chrome.scripting, chrome.storage.session), `background/*`, `storage/*`.
- Not yet verified against real api.vinted.pl (sandbox cannot reach it).
