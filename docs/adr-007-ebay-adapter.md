# ADR-007: eBay (ebay.com) adapter on the Browse API

## Status

Accepted, 2026-10-02. Partly reverses ADR-002: there are two sites again
(Vinted and eBay). Research: `docs/research-ebay.md`.

## Context

The user wants to watch ebay.com listings as well as Vinted. Research found
one sanctioned, working source: eBay's **Browse API**
(`item_summary/search`, `sort=newlyListed`).

- RSS and the Finding API are gone.
- Scraping the website hits Akamai bot protection, and eBay's User Agreement
  bans it.
- The Browse API's default quota is 5 000 calls/day **per app keyset**.

The user's decisions:

1. ebay.com, prices shown in **USD**.
2. **Bring your own key:** each user pastes their own keyset in Settings,
   with a short how-to and a link to developer.ebay.com.
3. Auctions are watched, but **marked differently** from fixed-price offers.
4. **Shipping** cost is shown next to the price, not added to it.

## Decision

**Adapter** (`extension/src/adapters/ebay/`):

- **Auth** (`auth.ts`):
  - Client-credentials token from
    `POST api.ebay.com/identity/v1/oauth2/token`, with Basic auth and scope
    `https://api.ebay.com/oauth/api_scope`.
  - The token is cached in `chrome.storage.session`, in memory only, so it
    survives service-worker restarts. It is keyed by client id and renewed
    5 min before expiry.
  - A 401 on search renews the token once and retries.
  - A 400/401 from the token endpoint means the keys are wrong (`EBY-AUTH`).
- **Search** (`api.ts`): `GET /buy/browse/v1/item_summary/search` with:
  - `X-EBAY-C-MARKETPLACE-ID: EBAY_US`
  - `X-EBAY-C-ENDUSERCTX: contextualLocation=country%3DPL`, so shipping costs
    are those to Poland
  - `sort=newlyListed` and `limit` (50; 96 for deal-mode seeding; max 200)
  - `filter=deliveryCountry:PL[,price:[min..max],priceCurrency:USD][,conditions:{NEW|USED}]`
- **Keywords:**
  - Single-word keywords are ORed into one call, `q=(a,b)`, because every
    call spends quota.
  - A multi-word keyword gets its own call. eBay doesn't document how it
    treats spaces inside the OR group.
  - `auto_correct` is left off.
  - Exclusions are not sent; the core matcher filters them, as for Vinted.
- **Item mapping:**
  - Dedup id is `legacyItemId` (the number in the ebay.com URL).
  - `postedAt` comes from `itemCreationDate`.
  - `location` is "city, country".
  - `shippingCost` is the cheapest `shippingOptions[].shippingCost` in the
    listing currency. It is absent when eBay only says "calculated".
  - Auctions (`buyingOptions` contains `AUCTION`) get
    `auction: { endsAt, bidCount }` and are priced at `currentBidPrice`.
- **Requests:** run from the service worker with `host_permissions` for
  `https://api.ebay.com/*`, so CORS doesn't apply. No cookies are sent.
- **Not configured:** without keys, `search` throws `EBY-KEYS`, and
  `isConfigured()` is false so health checks skip eBay instead of raising a
  "problem" banner.

**Domain:**

- `SiteId = "vinted" | "ebay"`. A watch still searches **one** site, picked in
  the form and fixed after creation. Its price filters and deal-mode market
  value are in that site's currency (`shared/sites.ts#watchCurrency`).
- `OfferRecord` gains optional `shippingCost` and `auction`.
- `Settings.ebay = { clientId, clientSecret }` is stored in
  `chrome.storage.local`. It is never put into diagnostics reports; those
  only say whether a key exists.
- New stable error codes `EBY-*` (KEYS, AUTH, 401, 403, 404, 429, 5XX, HTTP,
  NET, TIMEOUT, JSON, SHAPE, EMPTY). `codeForHttpStatus` and `toScanError`
  take a site prefix.
- **Deal mode ignores auctions** both when learning the median and when
  classifying. A fresh auction's bid ($0.99) is not the item's value, and it
  would look like a −99% deal.

**UI:**

- The new-watch form has a Vinted/eBay switch. The price field shows `$` for
  eBay, and the size field is Vinted-only.
- Without a key, the form points to Settings.
- **Prices:** `formatPrice(price, currency)` shows `$1,250` / `$12.99` for
  USD and keeps `4 200 zł` for PLN.
- **Offer rows:**
  - shipping under the price ("+ $38.50 wysyłka", "darmowa wysyłka")
  - a blue "Licytacja" pill
  - a line with bids and time left ("7 ofert · koniec za 1 dzień")
- Notifications, watch rows, the deal panel and e-mails (backend
  `formatPrice`) use the watch's or offer's currency.
- Settings has an "eBay — klucz API" panel:
  - a 4-step how-to and a link to developer.ebay.com/my/keys
  - App ID and Cert ID fields
  - "Zapisz i sprawdź", which saves and runs the eBay connection test, and
    "Usuń klucz"
- The sidebar and Serwisy show "nie skonfigurowano" until a key is saved.
- **Quick-add (F3)** also works on `www.ebay.com/sch/…` (`_nkw`, `_udhi`).

## Consequences

- **Quota:** each user has their own 5 000 calls/day. One eBay watch costs
  about 288 calls/day at 5 min or 720 at 2 min (deal mode), plus one call per
  extra multi-word keyword. A 429 shows as `EBY-429` with eBay's `errorId`.
- **Not verified against the real API.** The build sandbox can't reach any
  eBay host. The fixture (`tests/fixtures/ebay/item-summary-search.json`) is
  hand-written from the documented ItemSummary fields. Unverified details:
  - the `price:[10]` (minimum only) filter syntax
  - the `X-EBAY-C-ENDUSERCTX` encoding
  - shipping costs in the response being those to PL

  The first real run should be checked against them, using Diagnostyka's
  scan log.
- **Indexing delay:** eBay search can lag listing by 5–15 min, so faster
  polling buys little.
- **Shipping and import VAT:** shipping is shown, not included in deal-mode
  prices. Import VAT/duty to Poland is not estimated.
- **Not covered:** `excludeKeywords` aren't sent to eBay, so excluded items
  still use quota. Size and location aren't mapped.
