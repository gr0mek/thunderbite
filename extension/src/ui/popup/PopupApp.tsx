import { useEffect, useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import type { SearchContext } from "@/adapters/searchContext";
import type { SiteId } from "@/adapters/types";
import { SettingsSchema, type Settings, type Watch } from "@/shared/schemas";
import { getQuickAddContext } from "@/background/messages";
import { storage, useWatches } from "@/ui/shared/dataHooks";
import { Banner } from "@/ui/shared/Banner";
import { Toast } from "@/ui/shared/Toast";
import { useSystemStatus } from "@/ui/shared/useSystemStatus";
import { useToasts } from "@/ui/shared/useToasts";
import { TopBar } from "./components/TopBar";
import { Tabs } from "./components/Tabs";
import { NewOffersScreen } from "./screens/NewOffersScreen";
import { WatchingScreen } from "./screens/WatchingScreen";
import { NewWatchForm } from "@/ui/shared/NewWatchForm";

type Screen =
  | { kind: "tabs" }
  | {
      kind: "form";
      watch?: Watch;
      initialQuery?: { name: string; priceMax?: number | undefined };
    };

export function PopupApp() {
  const [screen, setScreen] = useState<Screen>({ kind: "tabs" });
  const [activeTab, setActiveTab] = useState<"new" | "watching">("new");
  const [settings, setSettings] = useState<Settings>(SettingsSchema.parse({}));
  const { watches, reload: reloadWatches } = useWatches();
  const { toasts, show } = useToasts();
  const { offline, notificationsDisabled } = useSystemStatus();
  const [quickAdd, setQuickAdd] = useState<{
    site: SiteId;
    context: SearchContext;
  } | null>(null);

  useEffect(() => {
    void storage.settings.get().then(setSettings);
    void getQuickAddContext().then(setQuickAdd);
  }, []);

  const [newCount, setNewCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function refreshCount() {
      const lists = await Promise.all(
        watches.map((w) => storage.offers.listByWatch(w.id, "new")),
      );
      if (!cancelled) {
        setNewCount(lists.flat().filter((o) => !o.isBaseline).length);
      }
    }
    void refreshCount();
    const id = setInterval(refreshCount, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watches]);

  if (screen.kind === "form") {
    return (
      <NewWatchForm
        watch={screen.watch}
        initialQuery={screen.initialQuery}
        settings={settings}
        onCancel={() => setScreen({ kind: "tabs" })}
        onDone={(watch) => {
          if (!screen.watch) show(copy.toast.watchingStarted(watch.name));
          reloadWatches();
          setScreen({ kind: "tabs" });
          setActiveTab("watching");
        }}
      />
    );
  }

  return (
    <div class="col f1" style={{ minHeight: 0 }}>
      <TopBar />
      <Tabs
        active={activeTab}
        newCount={newCount}
        watchingCount={watches.length}
        onChange={setActiveTab}
      />
      {offline && <Banner>{copy.banners.offline}</Banner>}
      {!offline && notificationsDisabled && (
        <Banner
          action={{
            label: copy.banners.enable,
            onClick: () =>
              chrome.tabs.create({ url: "chrome://settings/content/notifications" }),
          }}
        >
          {copy.banners.notificationsDisabled}
        </Banner>
      )}
      <div class="col f1" style={{ minHeight: 0 }}>
        {activeTab === "new" ? (
          <NewOffersScreen
            watches={watches}
            onAddWatch={() => setScreen({ kind: "form" })}
            quickAdd={quickAdd}
            onQuickAdd={() =>
              quickAdd &&
              setScreen({
                kind: "form",
                initialQuery: {
                  name: quickAdd.context.query,
                  priceMax: quickAdd.context.priceMax,
                },
              })
            }
          />
        ) : (
          <WatchingScreen
            watches={watches}
            onAddWatch={() => setScreen({ kind: "form" })}
            onEditWatch={(watch) => setScreen({ kind: "form", watch })}
            onReload={reloadWatches}
            onToast={show}
          />
        )}
      </div>
      {toasts.length > 0 && (
        <div class="popup-toast-stack">
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} onUndo={t.onUndo} />
          ))}
        </div>
      )}
    </div>
  );
}
