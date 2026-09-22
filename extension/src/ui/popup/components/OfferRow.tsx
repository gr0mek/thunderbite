import { copy } from "@/shared/copy.pl";
import { formatPrice } from "@/shared/format";
import type { OfferRecord } from "@/shared/schemas";
import { OfferTitleBlock } from "@/ui/shared/OfferTitleBlock";

interface OfferRowProps {
  offer: OfferRecord;
  watchName: string;
  onOpen: () => void;
  onHide: () => void;
}

/** uxSmartBuy.md §5.1: 72px row, thumbnail · title block · price (largest
 * accent, tabular numerals, right-aligned) with "Ukryj"/"Widziana" below it. */
export function OfferRow({ offer, watchName, onOpen, onHide }: OfferRowProps) {
  return (
    <div class="popup-offer-row" role="button" tabIndex={0} onClick={onOpen}>
      <span class="thumb" />
      <OfferTitleBlock offer={offer} watchName={watchName} />
      <div class="col gap1" style={{ alignItems: "flex-end" }}>
        <span
          class="text-price"
          style={{ color: offer.state === "seen" ? "var(--ink-muted)" : "var(--ink)" }}
        >
          {formatPrice(offer.price)}
        </span>
        {offer.state === "hidden" ? null : offer.state === "seen" ? (
          <span class="text-meta">{copy.offerRow.seenLabel}</span>
        ) : (
          <button
            type="button"
            class="text-meta"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onHide();
            }}
          >
            {copy.offerRow.hide}
          </button>
        )}
      </div>
    </div>
  );
}
