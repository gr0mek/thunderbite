import { useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import { formatPrice, formatRelativeTime, formatSiteList } from "@/shared/format";
import type { Watch } from "@/shared/schemas";
import { checkWatchNow, pauseWatch, resumeWatch } from "@/background/messages";
import {
  storage,
  useOffersByWatch,
  useSiteHealth,
  useWatch,
} from "@/ui/shared/dataHooks";
import { OfferTableRow } from "../components/OfferTableRow";

interface WatchDetailScreenProps {
  watchId: string;
  onBack: () => void;
  onEdit: (watch: Watch) => void;
}

type StateFilter = "new" | "seen" | "hidden";

export function WatchDetailScreen({ watchId, onBack, onEdit }: WatchDetailScreenProps) {
  const { watch, reload: reloadWatch } = useWatch(watchId);
  const [filter, setFilter] = useState<StateFilter>("new");
  const { offers, reload: reloadOffers } = useOffersByWatch(watchId, filter);
  const siteHealth = useSiteHealth();

  if (!watch) return null;

  const problemSite = watch.sites
    .map((s) => siteHealth.find((h) => h.site === s))
    .find((h) => h && h.status !== "ok");

  const counts = {
    new: offers.filter((o) => o.state === "new").length,
  };

  async function openOffer(key: string, url: string) {
    await storage.offers.setState(key, "seen");
    await chrome.tabs.create({ url });
    reloadOffers();
  }

  async function hideOffer(key: string) {
    await storage.offers.setState(key, "hidden");
    reloadOffers();
  }

  return (
    <div class="col gap4">
      <div class="fx ac jb" style={{ alignItems: "flex-start" }}>
        <div>
          <div class="text-meta">{copy.watchDetail.breadcrumb}</div>
          <div class="text-title" style={{ fontSize: 20, lineHeight: "28px" }}>
            {watch.name}
          </div>
          <div class="text-body" style={{ color: "var(--ink-muted)", marginTop: 4 }}>
            {copy.watchDetail.filterSentence(
              watch.name,
              watch.priceMax !== undefined ? formatPrice(watch.priceMax) : null,
              formatSiteList(watch.sites),
              copy.form.intervalPreset(watch.checkIntervalMinutes),
            )}
            {watch.lastCheckedAt &&
              ` · ${copy.watchDetail.checkedAgo(formatRelativeTime(watch.lastCheckedAt))}`}
          </div>
        </div>
        <div class="fx gap2 noshrink">
          <button type="button" class="btn btn-secondary" onClick={() => onEdit(watch)}>
            {copy.watchDetail.edit}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() =>
              void checkWatchNow(watch.id).then(() => {
                reloadWatch();
                reloadOffers();
              })
            }
          >
            {copy.watchDetail.checkNow}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() =>
              void (watch.paused ? resumeWatch(watch.id) : pauseWatch(watch.id)).then(
                reloadWatch,
              )
            }
          >
            {watch.paused ? copy.watchDetail.resume : copy.watchDetail.pause}
          </button>
        </div>
      </div>

      {problemSite && (
        <div class="banner banner--warn">
          <span>
            ⚠ <strong>{copy.watchTile.problem(copy.siteNames[problemSite.site])}</strong>
          </span>
        </div>
      )}

      <div class="fx gap2">
        <button
          type="button"
          class={`pill-tab ${filter === "new" ? "pill-tab--active" : ""}`}
          onClick={() => setFilter("new")}
        >
          {copy.watchDetail.filterTabs.new(counts.new)}
        </button>
        <button
          type="button"
          class={`pill-tab ${filter === "seen" ? "pill-tab--active" : ""}`}
          onClick={() => setFilter("seen")}
        >
          {copy.watchDetail.filterTabs.seen}
        </button>
        <button
          type="button"
          class={`pill-tab ${filter === "hidden" ? "pill-tab--active" : ""}`}
          onClick={() => setFilter("hidden")}
        >
          {copy.watchDetail.filterTabs.hidden}
        </button>
      </div>

      <div class="options-panel" style={{ padding: 0 }}>
        {offers.length === 0 ? (
          <div class="text-meta" style={{ padding: 16 }}>
            —
          </div>
        ) : (
          offers.map((offer, i) => (
            <div
              key={offer.key}
              style={{ borderTop: i > 0 ? "1px solid var(--line)" : undefined }}
            >
              <OfferTableRow
                offer={offer}
                onOpen={() => void openOffer(offer.key, offer.url)}
                onHide={() => void hideOffer(offer.key)}
              />
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        class="text-meta"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
        onClick={onBack}
      >
        ← {copy.watchDetail.breadcrumb.replace(" /", "")}
      </button>
    </div>
  );
}
