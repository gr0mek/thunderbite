import { useEffect, useState } from "preact/hooks";
import type { Settings, Watch } from "@/shared/schemas";
import { storage, useWatches } from "@/ui/shared/dataHooks";
import { NewWatchForm } from "@/ui/shared/NewWatchForm";
import { Sidebar, type OptionsRoute } from "./components/Sidebar";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { WatchesScreen } from "./screens/WatchesScreen";
import { WatchDetailScreen } from "./screens/WatchDetailScreen";
import { OffersScreen } from "./screens/OffersScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { DiagnosticsScreen } from "./screens/DiagnosticsScreen";

type Route = { kind: OptionsRoute } | { kind: "watch-detail"; watchId: string };

function parseHash(): Route {
  const match = /^#\/watches\/(.+)$/.exec(window.location.hash);
  if (match) return { kind: "watch-detail", watchId: match[1]! };
  if (window.location.hash === "#/offers") return { kind: "offers" };
  if (window.location.hash === "#/settings") return { kind: "settings" };
  if (window.location.hash === "#/diagnostics") return { kind: "diagnostics" };
  return { kind: "watches" };
}

export function OptionsApp() {
  const [route, setRoute] = useState<Route>(parseHash());
  const [settings, setSettings] = useState<Settings | null>(null);
  const { watches, reload: reloadWatches } = useWatches();
  const [formOverlay, setFormOverlay] = useState<{ watch?: Watch } | null>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    void storage.settings.get().then(setSettings);
  }, []);

  function navigate(next: Route) {
    setRoute(next);
    window.location.hash =
      next.kind === "watch-detail"
        ? `#/watches/${next.watchId}`
        : next.kind === "watches"
          ? ""
          : `#/${next.kind}`;
  }

  if (!settings) return null;

  if (!settings.onboardingCompletedAt) {
    return (
      <OnboardingScreen
        settings={settings}
        onComplete={() => {
          void storage.settings.get().then(setSettings);
          reloadWatches();
        }}
      />
    );
  }

  if (formOverlay) {
    return (
      <div class="fx jc" style={{ padding: "40px 16px" }}>
        <div style={{ width: 420 }}>
          <NewWatchForm
            watch={formOverlay.watch}
            settings={settings}
            onCancel={() => setFormOverlay(null)}
            onDone={(watch) => {
              setFormOverlay(null);
              reloadWatches();
              navigate({ kind: "watch-detail", watchId: watch.id });
            }}
          />
        </div>
      </div>
    );
  }

  const sidebarRoute: OptionsRoute =
    route.kind === "watch-detail" ? "watches" : route.kind;

  return (
    <div class="options-shell">
      <Sidebar
        active={sidebarRoute}
        onNavigate={(r) => navigate({ kind: r })}
        ebayConfigured={!!settings.ebay}
      />
      <div class="options-content">
        {route.kind === "watches" && (
          <WatchesScreen
            watches={watches}
            onOpenWatch={(w) => navigate({ kind: "watch-detail", watchId: w.id })}
            onAddWatch={() => setFormOverlay({})}
          />
        )}
        {route.kind === "watch-detail" && (
          <WatchDetailScreen
            watchId={route.watchId}
            onBack={() => navigate({ kind: "watches" })}
            onEdit={(watch) => setFormOverlay({ watch })}
          />
        )}
        {route.kind === "offers" && <OffersScreen watches={watches} />}
        {route.kind === "diagnostics" && <DiagnosticsScreen />}
        {route.kind === "settings" && (
          <SettingsScreen
            settings={settings}
            onSettingsChange={() => void storage.settings.get().then(setSettings)}
            onAllDataDeleted={() => {
              void storage.settings.get().then(setSettings);
              reloadWatches();
              navigate({ kind: "watches" });
            }}
          />
        )}
      </div>
    </div>
  );
}
