// F3 quick-add (uxSmartBuy.md §4 F3): reports the current page's search
// context (if any) to the background so the popup can offer "Obserwuj to
// wyszukiwanie" when opened on this tab. Detection is stubbed out for now
// — see adapters/searchContext.ts and docs/adr-001-adapter-fixture-blocker.md.
import { detectSearchContext } from "@/adapters/searchContext";
import type { SiteId } from "@/adapters/types";

function siteFromHostname(hostname: string): SiteId | null {
  if (hostname.endsWith("vinted.pl") || hostname.endsWith("vinted.com")) return "vinted";
  return null;
}

const site = siteFromHostname(location.hostname);
if (site) {
  const context = detectSearchContext(site, new URL(location.href), document);
  if (context) {
    void chrome.runtime.sendMessage({ type: "quickAdd/detected", site, context });
  }
}
