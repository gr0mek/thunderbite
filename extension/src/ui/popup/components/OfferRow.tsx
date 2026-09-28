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
    // No onClick/role on the row itself — nesting it as (or inside) another
    // interactive element together with the real "Ukryj" button would trip
    // axe's nested-interactive (WCAG) check. The title block is its own
    // real button, so opening the offer works from mouse and keyboard.
    <div class="popup-offer-row">
      <span class="thumb" />
      <button type="button" class="offer-row-trigger" onClick={onOpen}>
        <OfferTitleBlock offer={offer} watchName={watchName} />
      </button>
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
            class="text-meta offer-row-hide"
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
