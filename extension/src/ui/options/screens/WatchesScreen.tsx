import { copy } from "@/shared/copy.pl";
import { formatPrice, formatRelativeTime } from "@/shared/format";
import { watchCurrency } from "@/shared/sites";
import type { Watch } from "@/shared/schemas";
import { useAllOffers, useSiteHealth } from "@/ui/shared/dataHooks";
import { EmptyState } from "@/ui/shared/EmptyState";

interface WatchesScreenProps {
  watches: Watch[];
  onOpenWatch: (watch: Watch) => void;
  onAddWatch: () => void;
}

export function WatchesScreen({ watches, onOpenWatch, onAddWatch }: WatchesScreenProps) {
  const { offersByWatch } = useAllOffers(watches, "new");
  const siteHealth = useSiteHealth();

  function statusFor(watch: Watch): string {
    if (watch.paused) return copy.watchStatus.paused;
    const hasProblem = watch.sites.some(
      (s) => siteHealth.find((h) => h.site === s)?.status !== "ok",
    );
    return hasProblem ? copy.watchStatus.problem : copy.watchStatus.active;
  }

  return (
    <div class="col gap4">
      <div class="fx ac jb">
        <span class="text-title">{copy.optionsNav.watches}</span>
        <button type="button" class="btn btn-primary" onClick={onAddWatch}>
          {copy.popupFooter.addWatch}
        </button>
      </div>

      {watches.length === 0 ? (
        <EmptyState
          message={copy.emptyStates.noWatches}
          action={
            <button type="button" class="btn btn-primary" onClick={onAddWatch}>
              {copy.emptyStates.addFirstWatch}
            </button>
          }
        />
      ) : (
        <table class="options-table">
          <thead>
            <tr>
              <th>{copy.watchesTable.name}</th>
              <th>{copy.watchesTable.sites}</th>
              <th>{copy.watchesTable.priceMax}</th>
              <th>{copy.watchesTable.interval}</th>
              <th>{copy.watchesTable.newOffers}</th>
              <th>{copy.watchesTable.lastChecked}</th>
              <th>{copy.watchesTable.status}</th>
            </tr>
          </thead>
          <tbody>
            {watches.map((w) => {
              const newCount = (offersByWatch.get(w.id) ?? []).filter(
                (o) => !o.isBaseline,
              ).length;
              return (
                <tr
                  key={w.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpenWatch(w)}
                >
                  <td class="text-offer-title">{w.name}</td>
                  <td class="text-meta">
                    {w.sites.map((s) => copy.siteInitial[s]).join(" ")}
                  </td>
                  <td class="text-meta">
                    {w.priceMax !== undefined
                      ? formatPrice(w.priceMax, watchCurrency(w))
                      : "—"}
                  </td>
                  <td class="text-meta">
                    {copy.form.intervalPreset(w.checkIntervalMinutes)}
                  </td>
                  <td class="text-meta">{newCount}</td>
                  <td class="text-meta">
                    {w.lastCheckedAt ? formatRelativeTime(w.lastCheckedAt) : "—"}
                  </td>
                  <td class="text-meta">{statusFor(w)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
