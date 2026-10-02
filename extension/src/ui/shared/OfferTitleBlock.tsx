import { formatAuctionMeta, formatRelativeTime } from "@/shared/format";
import { copy } from "@/shared/copy.pl";
import type { OfferRecord } from "@/shared/schemas";

interface OfferTitleBlockProps {
  offer: OfferRecord;
  /** Third line — the watch that found it (popup's combined "Nowe" list
   * shows this; a watch's own detail view, already scoped to one watch,
   * doesn't need it). */
  watchName?: string;
}

/** Title + meta lines shared by the popup offer row and the options-page
 * offer table row (uxSmartBuy.md §5.1/§5.4 both use this shape). */
export function OfferTitleBlock({ offer, watchName }: OfferTitleBlockProps) {
  const isNew = offer.state === "new" && !offer.isBaseline;
  return (
    <div class="col gap1" style={{ minWidth: 0 }}>
      <div class="fx ac gap2">
        {isNew && <span class="new-dot" />}
        <span
          class="text-offer-title ellipsis"
          style={{ color: offer.state === "seen" ? "var(--ink-muted)" : "var(--ink)" }}
        >
          {offer.title}
        </span>
      </div>
      <div class="fx ac gap2 text-meta">
        <span class="site-badge" title={copy.siteNames[offer.site]}>
          {copy.siteInitial[offer.site]}
        </span>
        {offer.auction && (
          <span class="deal-pill auction-pill">{copy.offerRow.auction}</span>
        )}
        <span class="ellipsis">
          {[offer.location, formatRelativeTime(offer.foundAt)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {offer.auction && formatAuctionMeta(offer) && (
        <div class="text-meta ellipsis">{formatAuctionMeta(offer)}</div>
      )}
      {watchName && <div class="text-meta">{watchName}</div>}
    </div>
  );
}
