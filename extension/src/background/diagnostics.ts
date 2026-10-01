import { countVintedTabs } from "@/adapters/vinted/transport";
import { isVintedHeaderRuleActive } from "./vintedHeaders";

/** Name of Vinted's anonymous session cookie (the one the reference client
 * obtains by loading the home page). */
export const VINTED_SESSION_COOKIE = "access_token_web";

export interface DiagnosticsEnvironment {
  extensionVersion: string;
  userAgent: string;
  /** The Origin-stripping rule from vintedHeaders.ts is installed. */
  headerRuleActive: boolean;
  /** Open www.vinted.pl tabs usable for the tab fallback. */
  vintedTabs: number;
  /** Names only — values are never read out. */
  vintedCookieNames: string[];
  hasSessionCookie: boolean;
}

async function vintedCookieNames(): Promise<string[]> {
  if (!chrome.cookies?.getAll) return [];
  const cookies = await chrome.cookies.getAll({ domain: "vinted.pl" });
  return [...new Set(cookies.map((c) => c.name))].sort();
}

export async function collectEnvironment(): Promise<DiagnosticsEnvironment> {
  const [headerRuleActive, vintedTabs, names] = await Promise.all([
    isVintedHeaderRuleActive().catch(() => false),
    countVintedTabs().catch(() => 0),
    vintedCookieNames().catch((): string[] => []),
  ]);
  return {
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    headerRuleActive,
    vintedTabs,
    vintedCookieNames: names,
    hasSessionCookie: names.includes(VINTED_SESSION_COOKIE),
  };
}
