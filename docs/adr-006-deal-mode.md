# ADR-006: Deal mode ("tryb okazji")

## Status

Accepted, 2026-10-01.

## Context

The user wants to catch listings priced far below what an item is worth.
Example: an Olympus mju II usually sells for about 2 000 zł, and occasionally
someone lists one for 300 zł. A fixed "cena maks." can do this only roughly:
the user has to know the market price, keep it updated, and it lets
accessories and broken items through. The UI was agreed from a mockup. The
user's decisions:

- market value is automatic only (no manual override);
- the deal threshold defaults to 50%;
- notifications go out for deals only;
- the shortest check interval is 2 minutes;
- "suspiciously cheap" offers are never notified.

## Decision

- **Opt-in per watch.** `Watch.deal = { enabled, thresholdPct }`, with
  presets 30/40/50% and 50% as the default. `Watch.market` caches the latest
  `{ median, p25, p75, sampleSize }` for the UI.
- **Price history** (`PriceRepo`, IndexedDB store `prices`, DB version 2):
  - one entry per listing per watch, updated every time a scan sees it again;
  - only listings that pass the watch's keyword and exclusion filter are
    stored, so accessories never enter the market price;
  - entries older than 30 days are purged by housekeeping.
- **Market value** = the median of the last 30 days of prices
  (`core/market.ts`). The median is robust to outliers. Below 10 priced
  listings the market value is null, and deal mode stays silent rather than
  guessing.
- **Learning quickly:**
  - deal mode searches without `price_from`/`price_to`;
  - its first (silent baseline) check asks for 96 listings, so the median
    exists from minute one;
  - turning deal mode on later, or changing keywords or exclusions, wipes the
    history and re-runs that seeding baseline.
- **Classification** of each relevant listing:
  - **deal:** price ≤ thresholdPct% of the median;
  - **suspicious:** price < 10% of the median, usually an accessory or a scam;
  - everything else is not stored as an offer at all.

  Deal and suspicious offers are stored with `dealKind`, `marketPrice` and
  `discountPct`.
- **Notifications:**
  - deals only, never baseline offers and never suspicious ones;
  - one sticky (`requireInteraction`) notification per deal, e.g.
    "🔥 300 zł · title" / "−85% vs mediana 1 950 zł · Vinted";
  - grouped only when there are more than 3.
- **Interval:** deal-mode watches may check every 2 minutes; the schema
  enforces 5 minutes otherwise. The presets are 2/5/15 minutes.
- **Matching:** spelling-tolerant for every watch.
  - Punctuation counts as a space and `μ` becomes "mju".
  - The roman numerals II, III and IV match 2, 3 and 4.
  - So "mju-II", "mju:ii", "μ-II" and "mju 2" all match "mju II". Substring
    semantics are unchanged.
- **UI:**
  - the form has a "Tryb okazji" card with the learned market value,
    threshold presets with a live zł preview, and "Pomijaj" pre-filled with
    common junk words. The price fields are hidden in deal mode;
  - the popup shows "🔥 Okazje" and "⚠ Podejrzanie tanie" sections with a
    discount pill and a struck-through market price;
  - each watch row in the popup has a threshold/median bar;
  - the watch detail page has market tiles, a 30-day price dot plot with the
    deal zone, and a table of deals caught.

## Consequences

- A deal-mode watch is useful from its first check, as long as Vinted has at
  least 10 matching priced listings. Rarer items show "uczę się cen" until
  enough history builds up.
- Deal and suspicious listings feed the history too, which nudges the median
  slightly. That is accepted: they are real listings, and the median barely
  moves.
- 2-minute polling means up to about 30 requests an hour per deal watch. The
  site rate limiter (5 s spacing) and the diagnostics screen will show it
  if Vinted starts answering 429.
