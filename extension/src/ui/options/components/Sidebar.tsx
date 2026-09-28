import { copy } from "@/shared/copy.pl";
import { BrandMark } from "@/ui/shared/BrandMark";
import { useSiteHealth } from "@/ui/shared/dataHooks";

export type OptionsRoute = "watches" | "offers" | "settings";

interface SidebarProps {
  active: OptionsRoute;
  onNavigate: (route: OptionsRoute) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const health = useSiteHealth();
  return (
    <div class="options-sidebar">
      <span class="fx ac gap2">
        <BrandMark />
        <span class="brand-name">Thunder Bait</span>
      </span>
      <nav class="col gap1">
        <button
          type="button"
          class={`options-nav-item ${active === "watches" ? "options-nav-item--active" : ""}`}
          onClick={() => onNavigate("watches")}
        >
          {copy.optionsNav.watches}
        </button>
        <button
          type="button"
          class={`options-nav-item ${active === "offers" ? "options-nav-item--active" : ""}`}
          onClick={() => onNavigate("offers")}
        >
          {copy.optionsNav.offers}
        </button>
        <button
          type="button"
          class={`options-nav-item ${active === "settings" ? "options-nav-item--active" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          {copy.optionsNav.settings}
        </button>
      </nav>
      <div style={{ height: 1, background: "var(--line)" }} />
      <div class="col gap2">
        <div class="text-meta" style={{ fontWeight: 600 }}>
          {copy.settings.servicesSection}
        </div>
        {health.map((h) => (
          <span key={h.site} class="fx ac gap2 text-meta">
            <span
              class={`status-dot status-dot--${h.status === "ok" ? "ok" : "degraded"}`}
            />
            {copy.siteNames[h.site]} —{" "}
            {h.status === "ok"
              ? copy.settings.serviceWorking
              : copy.settings.serviceProblem}
          </span>
        ))}
      </div>
    </div>
  );
}
