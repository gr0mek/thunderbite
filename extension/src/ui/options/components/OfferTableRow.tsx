import { copy } from "@/shared/copy.pl";
import { formatPrice, formatShipping } from "@/shared/format";
import type { OfferRecord } from "@/shared/schemas";
import { OfferTitleBlock } from "@/ui/shared/OfferTitleBlock";

interface OfferTableRowProps {
  offer: OfferRecord;
  onOpen: () => void;
  onHide: () => void;
}

/** uxSmartBuy.md §5.4: same list as the popup, wider — 5 columns instead
 * of a stacked price/hide corner. */
export function OfferTableRow({ offer, onOpen, onHide }: OfferTableRowProps) {
  const stateLabel = copy.offerState[offer.state];
  return (
    <div class="offer-table-row" style={{ opacity: offer.state === "hidden" ? 0.65 : 1 }}>
      <span class="thumb" />
      <button type="button" class="offer-row-trigger" onClick={onOpen}>
        <OfferTitleBlock offer={offer} />
      </button>
      <span class="col tr">
        <span class="text-price">{formatPrice(offer.price, offer.currency)}</span>
        {formatShipping(offer) && <span class="text-meta">{formatShipping(offer)}</span>}
      </span>
      <span class="text-meta tr">{stateLabel}</span>
      {offer.state === "hidden" ? (
        <span />
      ) : (
        <button
          type="button"
          class="text-meta tr"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
        >
          {copy.offerRow.hide}
        </button>
      )}
    </div>
  );
}
