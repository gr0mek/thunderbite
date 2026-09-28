import { copy } from "@/shared/copy.pl";
import type { SearchContext } from "@/adapters/searchContext";
import type { SiteId } from "@/adapters/types";

interface QuickAddBannerProps {
  site: SiteId;
  context: SearchContext;
  onAdd: () => void;
}

/** uxSmartBuy.md §4 F3 — only shown when the active tab is a marketplace
 * search page (wireframe 1a's `showQuickBanner`). */
export function QuickAddBanner({ site, context, onAdd }: QuickAddBannerProps) {
  const extra = context.priceMax ? `, do ${context.priceMax} zł` : "";
  return (
    <div class="popup-quickadd">
      <div class="text-meta">
        {copy.quickAddBanner.contextLine(copy.siteNames[site], context.query, extra)}
      </div>
      <div class="fx ac jb" style={{ marginTop: 4 }}>
        <span class="text-body">{copy.quickAddBanner.title}</span>
        <button
          type="button"
          class="icon-btn"
          style={{ background: "var(--action)", color: "var(--on-action)" }}
          onClick={onAdd}
        >
          +
        </button>
      </div>
    </div>
  );
}
