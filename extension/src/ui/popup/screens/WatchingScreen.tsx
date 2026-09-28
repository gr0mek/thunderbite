import { copy } from "@/shared/copy.pl";
import type { Watch } from "@/shared/schemas";
import {
  checkWatchNow,
  deleteWatch,
  pauseWatch,
  resumeWatch,
} from "@/background/messages";
import { useAllOffers, useSiteHealth } from "@/ui/shared/dataHooks";
import { EmptyState } from "@/ui/shared/EmptyState";
import { WatchRow } from "../components/WatchRow";

interface WatchingScreenProps {
  watches: Watch[];
  onAddWatch: () => void;
  onEditWatch: (watch: Watch) => void;
  onReload: () => void;
  onToast: (message: string, onUndo?: () => void) => void;
}

export function WatchingScreen({
  watches,
  onAddWatch,
  onEditWatch,
  onReload,
  onToast,
}: WatchingScreenProps) {
  const { offersByWatch } = useAllOffers(watches, "new");
  const siteHealth = useSiteHealth();

  if (watches.length === 0) {
    return (
      <EmptyState
        message={copy.emptyStates.noWatches}
        action={
          <button type="button" class="btn btn-primary" onClick={onAddWatch}>
            {copy.emptyStates.addFirstWatch}
          </button>
        }
      />
    );
  }

  async function handleDelete(watch: Watch) {
    await deleteWatch(watch.id);
    onToast(copy.toast.watchDeleted(watch.name));
    onReload();
  }

  return (
    <div class="col f1" style={{ minHeight: 0 }}>
      <div class="col popup-scroll">
        {watches.map((watch) => (
          <WatchRow
            key={watch.id}
            watch={watch}
            newCount={
              (offersByWatch.get(watch.id) ?? []).filter((o) => !o.isBaseline).length
            }
            siteHealth={siteHealth}
            onOpenDetail={() =>
              chrome.tabs.create({
                url: chrome.runtime.getURL(
                  `src/ui/options/index.html#/watches/${watch.id}`,
                ),
              })
            }
            onTogglePaused={async (paused) => {
              if (paused) {
                await pauseWatch(watch.id);
                onToast(
                  copy.toast.watchPaused(watch.name),
                  () => void resumeWatch(watch.id).then(onReload),
                );
              } else {
                await resumeWatch(watch.id);
              }
              onReload();
            }}
            onEdit={() => onEditWatch(watch)}
            onCheckNow={() => void checkWatchNow(watch.id).then(onReload)}
            onDelete={() => void handleDelete(watch)}
          />
        ))}
      </div>
      <div class="popup-footer popup-footer--end">
        <button type="button" class="btn btn-primary" onClick={onAddWatch}>
          {copy.popupFooter.addWatch}
        </button>
      </div>
    </div>
  );
}
