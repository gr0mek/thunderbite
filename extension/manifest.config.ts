import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

const SITE_HOSTS = ["*://*.vinted.pl/*", "*://*.vinted.com/*"];

export default defineManifest({
  manifest_version: 3,
  name: "Thunder Bait",
  description: "Automatycznie sprawdza Vinted i powiadamia o nowych, pasujących ofertach.",
  version: pkg.version,
  // No default_locale: nothing here uses chrome.i18n — every string is
  // hardcoded Polish via shared/copy.pl.ts (uxSmartBuy.md §10 DoD). Setting
  // default_locale without a matching _locales/<locale>/messages.json makes
  // Chrome treat the whole extension as invalid and refuse to load it.
  icons: {
    16: "src/assets/icon-16.png",
    32: "src/assets/icon-32.png",
    48: "src/assets/icon-48.png",
    128: "src/assets/icon-128.png",
  },
  action: {
    default_popup: "src/ui/popup/index.html",
  },
  options_page: "src/ui/options/index.html",
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: ["storage", "alarms", "notifications", "offscreen"],
  // Scoped strictly to the tracked marketplace + backend, per
  // startSmartBuy.md §6 rule 9 (host_permissions MUST NOT be broader).
  host_permissions: [...SITE_HOSTS, "https://*.supabase.co/*"],
  content_scripts: [
    {
      matches: SITE_HOSTS,
      js: ["src/ui/content/quick-add.tsx"],
      run_at: "document_idle",
    },
  ],
});
