import { copy } from "@/shared/copy.pl";
import { formatPrice, formatRelativeTime } from "@/shared/format";
import type { SiteHealth, Watch } from "@/shared/schemas";
import { Menu } from "@/ui/shared/Menu";
import { Toggle } from "@/ui/shared/Toggle";

interface WatchRowProps {
  watch: Watch;
  newCount: number;
  siteHealth: SiteHealth[];
  onOpenDetail: () => void;
  onTogglePaused: (paused: boolean) => void;
  onEdit: () => void;
  onCheckNow: () => void;
  onDelete: () => void;
}

/** uxSmartBuy.md §5.2 — a row, not a tile: the wireframes' tile variant
 * (1c) is annotated as breaking down past ~6 watches, and the watch limit
 * is 20, so rows are what actually ships. */
export function WatchRow({
  watch,
  newCount,
  siteHealth,
  onOpenDetail,
  onTogglePaused,
  onEdit,
  onCheckNow,
  onDelete,
}: WatchRowProps) {
  const problemSite = watch.sites
    .map((s) => siteHealth.find((h) => h.site === s))
    .find((h) => h && h.status !== "ok");

  const metaParts = [
    watch.priceMax !== undefined ? `do ${formatPrice(watch.priceMax)}` : null,
    watch.sites.map((s) => copy.siteInitial[s]).join(" "),
    `co ${copy.form.intervalPreset(watch.checkIntervalMinutes)}`,
  ].filter(Boolean);

  return (
    <div class="popup-watch-row" role="button" tabIndex={0} onClick={onOpenDetail}>
      <div class="fx ac jb gap2">
        <span class="text-offer-title ellipsis">{watch.name}</span>
        <span class="fx ac gap2 noshrink" onClick={(e) => e.stopPropagation()}>
          <Toggle
            checked={!watch.paused}
            onChange={(next) => onTogglePaused(!next)}
            label={watch.paused ? copy.watchMenu.resume : copy.watchMenu.pause}
          />
          <Menu
            label={copy.watchMenu.edit}
            items={[
              { label: copy.watchMenu.edit, onSelect: onEdit },
              { label: copy.watchMenu.checkNow, onSelect: onCheckNow },
              { label: copy.watchMenu.delete, onSelect: onDelete, danger: true },
            ]}
          />
        </span>
      </div>
      <div class="text-meta">{metaParts.join(" · ")}</div>
      {watch.paused ? (
        <div class="text-meta">{copy.watchTile.paused}</div>
      ) : problemSite ? (
        <div class="text-meta" style={{ color: "var(--warn)" }}>
          ⚠ {copy.watchTile.problem(copy.siteNames[problemSite.site])}
        </div>
      ) : (
        <div class="fx ac gap2">
          {newCount > 0 && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                background: "var(--tag)",
                color: "var(--on-tag)",
                font: "700 11px/16px var(--font-family)",
              }}
            >
              {copy.watchTile.newBadge(newCount)}
            </span>
          )}
          {watch.lastCheckedAt && (
            <span class="text-meta">
              {copy.watchTile.checkedAgo(formatRelativeTime(watch.lastCheckedAt))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
