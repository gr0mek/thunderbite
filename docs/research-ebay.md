# Research: watching eBay (ebay.com) listings

Status: research only, nothing implemented. Written 2026-10-02 as input for a
future ADR-007 ("eBay adapter").

The build environment cannot reach any eBay host (`www.ebay.com`,
`api.ebay.com`, `developer.ebay.com`: proxy-blocked). Everything below comes
from eBay's API docs, as quoted by search results and by the generated SDKs
mirrored on GitHub, and from open-source monitors. Facts marked **(verify)**
come from memory or a single source. Check them against a real response
before relying on them, as ADR-001 requires.

## 1. Ways to get new eBay listings

| Option | State in 2026 | Verdict |
| --- | --- | --- |
| **Browse API** `item_summary/search`, `sort=newlyListed` | Official, current, read-only, needs an app key | **Use this** |
| Scraping `www.ebay.com/sch/i.html?_nkw=…&_sop=10` | Works, but Akamai Bot Manager returns 403 to a bare request. The User Agreement bans scrapers (updated 20 Feb 2026) | Fallback only, not recommended |
| Search RSS (`&_rss=1`) | Dead on ebay.com since Jan 2023 | ✗ |
| Finding API (`findItemsAdvanced`) | Decommissioned 5 Feb 2025 | ✗ |
| Buy Feed API (daily item feeds) | Restricted, needs approval, daily granularity | ✗ |
| eBay's own saved-search e-mails | No integration point | ✗ |

### Why not scraping

[liam02k/listing-watch](https://github.com/liam02k/listing-watch) is a
current, working HTML monitor. It shows what scraping costs:

- **Session:** a bare scripted request gets 403 even from a residential IP.
  It warms up with `GET ebay.com` to collect Akamai cookies (`bm_s`,
  `bm_so`), and re-warms every 30 min.
- **Parsing:** HTML selectors `li.s-card`, with `li.s-item` as the older
  fallback. It must also drop sponsored "Shop on eBay" cards.
- **Rate:** it polls every ≥2 min with jitter and backs off 2×/4×/8× on
  429/403/503 or on empty pages.
- **Autocorrect:** eBay silently rewrites queries. The workaround is adding a
  dummy `-word` exclusion.

In an extension this would mean reusing ADR-004's open-tab fallback. Our own
selectors would break whenever eBay redesigns, and eBay's User Agreement
explicitly bans "robot, spider, scraper… or any other automated means" without
permission. The Browse API avoids all of that.

## 2. Browse API contract

### Auth: application token (client credentials)

```
POST https://api.ebay.com/identity/v1/oauth2/token
Authorization: Basic base64(<client_id>:<client_secret>)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope
```

- The token lives about 2 h (`expires_in` 7200). Cache it, and refresh it on
  401.
- No user login is needed, because Browse only reads public data.
- Keys come from developer.ebay.com → Application Keys (Production keyset).

### Search

```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
Authorization: Bearer <app token>
X-EBAY-C-MARKETPLACE-ID: EBAY_US        # ebay.com; EBAY_PL / EBAY_DE / EBAY_GB also supported
X-EBAY-C-ENDUSERCTX: contextualLocation=country%3DPL   # shipping estimates to Poland (verify encoding)
```

| Param | Use |
| --- | --- |
| `q` | Space = AND. `(a,b)` = OR, so **all of a watch's keywords fit in one call**, unlike Vinted's one call per keyword. No `*` wildcard. `-word` exclusion **(verify)**; the core matcher re-filters anyway. |
| `sort=newlyListed` | Newest first, sorted by `itemCreationDate`. |
| `limit` | Default 50, max 200 per page, 10 000 per result set. |
| `category_ids` | One category. A top-level (L1) category also requires `q`. |
| `filter` | Comma-separated, see below. |
| `auto_correct=KEYWORD` | Opt-in, so leave it **off** (the default). This avoids the silent rewrite scrapers fight. |

Supported `filter` fields: `bidCount, buyingOptions, charityOnly,
conditionIds, conditions, deliveryCountry, deliveryOptions,
deliveryPostalCode, excludeCategoryIds, excludeSellers,
guaranteedDeliveryInDays, itemEndDate, itemLocationCountry, itemStartDate,
maxDeliveryCost, paymentMethods, pickupCountry, pickupPostalCode,
pickupRadius, pickupRadiusUnit, price, priceCurrency, priorityListing,
qualifiedPrograms, returnsAccepted, searchInDescription,
sellerAccountTypes, sellers`.

Mapping from `SearchQuery`:

| Thunder Bait | eBay `filter` |
| --- | --- |
| `priceMin`/`priceMax` | `price:[100..500],priceCurrency:USD` (`price` requires `priceCurrency`) |
| `condition: "new"` | `conditions:{NEW}` |
| `condition: "used"` | `conditions:{USED}` |
| ships to the user | `deliveryCountry:PL`. Without it, half of ebay.com is US-only shipping. |
| deal mode | `buyingOptions:{FIXED_PRICE}`, see §4 |
| `location` | not mapped. `pickupRadius` is for local pickup only, which is useless from PL. |

### Response (`itemSummaries[]`)

Fields we need:

- `itemId`, e.g. `v1|123456789|0`, and `legacyItemId`, e.g. `123456789`.
  Dedup key: `ebay:<legacyItemId>`.
- `title`
- `itemWebUrl`
- `image.imageUrl`
- `price.value` (a **string**) and `price.currency`. With
  `X-EBAY-C-ENDUSERCTX`, also `convertedFromValue`/`convertedFromCurrency`
  **(verify)**.
- `currentBidPrice`, for auctions
- `buyingOptions[]`: `FIXED_PRICE`, `AUCTION` and `BEST_OFFER`
- `condition` and `conditionId`
- `itemCreationDate` → `postedAt`. Unlike svc-catalogue, there is a real
  listing timestamp.
- `seller.username` and `seller.feedbackPercentage` → `seller`
- `itemLocation.country`
- `shippingOptions[].shippingCost`

## 3. The real constraint: 5 000 calls/day per application

The Browse API's default limit is **5 000 calls/day per app keyset**, shared
by everyone using that keyset. A keyset can get more through eBay's free
**Application Growth Check** review. If the limit is exceeded, the API answers
`429` / errorId `2001` "Too many requests". Forum threads also report 2001
well below the quota.

At one call per watch check, which is possible thanks to OR in `q`:

| Interval | Calls/day per watch | Watches per 5 000 |
| --- | --- | --- |
| 2 min (deal mode) | 720 | 6 |
| 5 min | 288 | 17 |
| 15 min | 96 | 52 |

That is plenty for one person and nowhere near enough for a public
extension on one shared key. There are three ways to supply keys:

1. **Bring your own key (recommended for now).**
   - The user pastes their Client ID and Secret in Ustawienia → eBay.
   - Both are stored in `chrome.storage.local`, and the service worker mints
     tokens itself.
   - Each user gets their own 5 000/day, no backend change is needed, and
     there is no shared secret to leak.
   - The cost is about 10 minutes of setup on developer.ebay.com, so
     onboarding needs a guide.
2. **Shared key behind Supabase.**
   - A new edge function `ebay-token` holds the secret and hands out cached
     app tokens. The extension then calls api.ebay.com directly.
   - The secret never ships in the bundle. **Never put a client secret in
     the extension**: anyone can unzip a CRX.
   - Needs a Growth Check before more than a handful of users. The token
     endpoint also needs some abuse gate, e.g. the existing backend client
     auth.
3. **Both:** BYO key when present, shared key otherwise.

CORS is not a problem. The MV3 service worker with `host_permissions` for
`https://api.ebay.com/*` is not subject to CORS. The "proxy required" advice
in [hendt/ebay-api](https://github.com/hendt/ebay-api) applies to ordinary
web pages.

## 4. eBay-specific pitfalls

- **Freshness.** Sellers and forums report a 5–15 min (sometimes much longer)
  delay between listing and appearing in search. Polling eBay faster than
  every 2–5 min gains little and burns quota, so the minimum interval stays
  where it is.
- **Auctions break deal mode.**
  - A fresh auction's `currentBidPrice` (e.g. $0.99) is not its value.
    Every new auction would look like a −95% "deal" and land in the
    "suspicious" bucket at best.
  - Deal mode must send `buyingOptions:{FIXED_PRICE}` and ignore
    `AUCTION`-only items, both when learning the median and when
    classifying.
  - Normal watches could still notify on auctions, labelled "Licytacja".
- **Currency.**
  - `NormalizedOffer.price` is documented as PLN, but ebay.com prices are
    USD. The field comment and the UI formatting need to take
    `offer.currency`.
  - Deal mode's median is fine as long as one watch sees one currency, which
    is true per marketplace.
  - `priceCurrency` must match what the user typed (USD on EBAY_US).
- **Shipping and import costs.**
  - A $300 camera with $60 shipping plus ~23% PL import VAT is not a deal.
  - First version: show shipping from `shippingOptions` (needs
    `X-EBAY-C-ENDUSERCTX` with `country=PL`) next to the price. Later:
    optionally include it in the deal-mode comparison.
- **No sold-price data.** Sold prices are in the Marketplace Insights API,
  which is restricted. Deal mode keeps learning from active listings, as it
  does on Vinted.
- **Quota is per call, not per item.** Ask for `limit=50` normally and 200
  for deal-mode seeding (ADR-006's 96 fits in one call).

## 5. What changes in Thunder Bait

The design for this is ADR-002's: per-site plumbing is generic over `SiteId`.

- `adapters/types.ts`: `SiteId = "vinted" | "ebay"`.
- New `adapters/ebay/` with these parts, plus a hand-written fixture in
  `tests/fixtures/ebay/` matching §2. Replace it with a captured response
  when possible.
  - `api.ts` builds `q`/`filter` and holds the Zod schema plus
    `normalizeItem`.
  - `auth.ts` mints and caches the token, refreshing on 401.
  - `index.ts` contains:
    - `minIntervalMs`: about 5 s
    - `healthCheck`: `q=test&limit=5`
- `manifest.config.ts`:
  - `host_permissions` adds `https://api.ebay.com/*`.
  - Quick-add (F3) needs the content script on `*://*.ebay.com/sch/*`.
    `detectSearchContext` reads `_nkw` (keywords) and `_udlo`/`_udhi`
    (price) **(verify)**.
- `shared/scanErrors.ts` adds an `EBY-` family:
  - `EBY-401`: token or keys invalid
  - `EBY-429`: quota or errorId 2001
  - `EBY-KEYS`: no keys configured
- UI:
  - Restore the site picker that ADR-002 removed, plus the filter in
    `OffersScreen`.
  - Add an eBay keys form and onboarding step.
  - Add `siteNames`/`siteInitial` in `copy.pl.ts`.
  - Show the currency per offer, and add the "Licytacja" badge.
- Deal mode: forced `FIXED_PRICE`, and history kept per site and watch.
- The Vinted-only tab fallback and DNR header rules are not needed for eBay.

## 6. Open questions for the product owner

1. **Which marketplace?** ebay.com (`EBAY_US`, USD) as asked. Also consider
   `EBAY_DE`/`EBAY_PL` (EUR/PLN, EU shipping, no import VAT), which may be the
   better default for a Polish user. The marketplace could be a per-watch
   setting.
2. **Keys:** BYO key (option 1) for the MVP, or apply for a shared key with a
   Growth Check?
3. **Auctions** in normal watches: notify, or Buy It Now only?
4. **Shipping** to PL: show it only, or include it in the deal price?

## Sources

- eBay Browse API overview (5 000/day; one call returns ≤200 items):
  https://developer.ebay.com/api-docs/buy/browse/overview.html
- `item_summary/search` method:
  https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
  (params and filters as mirrored in
  https://github.com/UAPL/ebay-openapi-php/blob/main/docs/Api/ItemSummaryApi.md)
- Buy API filter reference: https://developer.ebay.com/api-docs/buy/ref-buy-browse-filters.html
- API call limits / Growth Check: https://developer.ebay.com/develop/get-started/api-call-limits,
  https://developer.ebay.com/api-docs/static/gs_request-an-application-growth.html
- 429 / errorId 2001 below quota:
  https://community.ebay.com/t5/eBay-APIs-Talk-to-your-fellow/Browse-API-returning-Error-2001-Too-Many-Requests-despite-plenty/m-p/33989349
- Finding API decommission: https://developer.ebay.com/docs/api-deprecation
- RSS gone: https://valueaddedresource.net/ebay-rss-feed-stores-search
- User Agreement bans scrapers/bots (Feb 2026):
  https://www.ecommercebytes.com/2026/01/21/ebay-bans-ai-shopping-agents-updates-arbitration-provision/
- Listing/search indexing delay:
  https://community.ebay.com/t5/Report-eBay-Technical-Issues/delay-on-view-of-my-new-items/m-p/26985765
- EBAY_PL supported by Browse: https://developer.ebay.com/api-docs/buy/ref-marketplace-supported.html
- Reference monitors: https://github.com/liam02k/listing-watch (HTML scraping),
  https://github.com/Jose9630/ebayyagent (Browse API, 120 s polling, OR in `q`),
  https://github.com/hendt/ebay-api (TS client, CORS note)
