import { useMemo, useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import type { OfferRecord, Watch } from "@/shared/schemas";
import { storage, useAllOffers } from "@/ui/shared/dataHooks";
import { EmptyState } from "@/ui/shared/EmptyState";
import { OfferTableRow } from "../components/OfferTableRow";

interface OffersScreenProps {
  watches: Watch[];
}

type StateFilter = "new" | "seen" | "hidden";

export function OffersScreen({ watches }: OffersScreenProps) {
  const [stateFilter, setStateFilter] = useState<StateFilter>("new");
  const [watchId, setWatchId] = useState<string>("");
  const { offersByWatch, reload } = useAllOffers(watches, stateFilter);

  const watchNames = useMemo(
    () => new Map(watches.map((w) => [w.id, w.name])),
    [watches],
  );

  const rows: { offer: OfferRecord; watchName: string }[] = [];
  for (const [id, offers] of offersByWatch) {
    if (watchId && id !== watchId) continue;
    const watchName = watchNames.get(id) ?? "";
    for (const offer of offers) {
      rows.push({ offer, watchName });
    }
  }
  rows.sort((a, b) => b.offer.foundAt.localeCompare(a.offer.foundAt));

  async function openOffer(key: string, url: string) {
    await storage.offers.setState(key, "seen");
    await chrome.tabs.create({ url });
    reload();
  }
  async function hideOffer(key: string) {
    await storage.offers.setState(key, "hidden");
    reload();
  }

  return (
    <div class="col gap4">
      <span class="text-title">{copy.optionsNav.offers}</span>

      <div class="fx ac gap3 wrap">
        <div class="fx gap2">
          {(["new", "seen", "hidden"] as const).map((f) => (
            <button
              key={f}
              type="button"
              class={`pill-tab ${stateFilter === f ? "pill-tab--active" : ""}`}
              onClick={() => setStateFilter(f)}
            >
              {copy.offerState[f]}
            </button>
          ))}
        </div>
        <select
          class="select-field"
          style={{ width: "auto" }}
          aria-label={copy.optionsNav.watches}
          value={watchId}
          onChange={(e) => setWatchId((e.target as HTMLSelectElement).value)}
        >
          <option value="">
            {copy.optionsNav.watches}: {copy.common.allFeminine}
          </option>
          {watches.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={copy.offersScreen.empty} />
      ) : (
        <div class="options-panel" style={{ padding: 0 }}>
          {rows.map((row, i) => (
            <div
              key={row.offer.key}
              style={{ borderTop: i > 0 ? "1px solid var(--line)" : undefined }}
            >
              <OfferTableRow
                offer={row.offer}
                onOpen={() => void openOffer(row.offer.key, row.offer.url)}
                onHide={() => void hideOffer(row.offer.key)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
