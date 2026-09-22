import { useEffect, useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import { SettingsSchema, type Settings, type Watch } from "@/shared/schemas";
import { storage, useWatches } from "@/ui/shared/dataHooks";
import { Toast } from "@/ui/shared/Toast";
import { useToasts } from "@/ui/shared/useToasts";
import { TopBar } from "./components/TopBar";
import { Tabs } from "./components/Tabs";
import { NewOffersScreen } from "./screens/NewOffersScreen";
import { WatchingScreen } from "./screens/WatchingScreen";
import { NewWatchForm } from "@/ui/shared/NewWatchForm";

type Screen = { kind: "tabs" } | { kind: "form"; watch?: Watch };

export function PopupApp() {
  const [screen, setScreen] = useState<Screen>({ kind: "tabs" });
  const [activeTab, setActiveTab] = useState<"new" | "watching">("new");
  const [settings, setSettings] = useState<Settings>(SettingsSchema.parse({}));
  const { watches, reload: reloadWatches } = useWatches();
  const { toasts, show } = useToasts();

  useEffect(() => {
    void storage.settings.get().then(setSettings);
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
      <div class="col f1" style={{ minHeight: 0 }}>
        {activeTab === "new" ? (
          <NewOffersScreen
            watches={watches}
            onAddWatch={() => setScreen({ kind: "form" })}
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
