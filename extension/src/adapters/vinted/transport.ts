// How a single HTTP request to Vinted is actually made. Two transports:
//
// - "sw": a plain fetch() from the extension's service worker. Cheapest,
//   needs no open tab, but Vinted sees an extension-originated request
//   (background/vintedHeaders.ts strips the tell-tale Origin header).
// - "tab": the same fetch() executed inside an open www.vinted.pl tab via
//   chrome.scripting — a genuine same-origin request with the page's own
//   cookies and anti-bot state. Used when the service-worker request is
//   refused (see ./index.ts).

import { VINTED_WEB_URL } from "./api";

export interface RawResponse {
  status: number;
  body: string;
}

/** The reference client (Vinted-Notifications) sends a browser-like
 * Accept + Accept-Language (`default_headers`) with a real browser
 * User-Agent. We are a real browser, so the UA is already right; Accept is
 * what Vinted's own web app sends to this API, and Accept-Language is
 * Polish for vinted.pl. */
export const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
};

/** The anonymous (or logged-in) session svc-catalogue authenticates with. */
export interface VintedAuth {
  /** `access_token_web` cookie — sent as the bearer token. */
  token?: string | undefined;
  /** `anon_id` cookie — sent as `x-anon-id`, like the website does. */
  anonId?: string | undefined;
}

export function authHeaders(auth: VintedAuth): Record<string, string> {
  const headers: Record<string, string> = { ...REQUEST_HEADERS };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth.anonId) headers["x-anon-id"] = auth.anonId;
  return headers;
}

export type ReadAuth = () => Promise<VintedAuth>;

/** Reads the session cookies with chrome.cookies (values never leave the
 * extension except as these request headers). */
export const readAuthFromCookies: ReadAuth = async () => {
  if (typeof chrome === "undefined" || !chrome.cookies?.get) return {};
  const get = async (name: string) =>
    (await chrome.cookies.get({ url: `${VINTED_WEB_URL}/`, name }))?.value;
  const [token, anonId] = await Promise.all([get("access_token_web"), get("anon_id")]);
  return { token, anonId };
};

export type SwFetch = (url: string, init: RequestInit) => Promise<RawResponse>;

export const swFetch: SwFetch = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
};

/**
 * Runs `url` through an already-open Vinted tab. Resolves to null when
 * there is no usable tab — this never opens one on its own.
 */
export type TabFetch = (
  url: string,
  headers: Record<string, string>,
) => Promise<RawResponse | null>;

export const tabFetch: TabFetch = async (url, headers) => {
  if (typeof chrome === "undefined" || !chrome.scripting || !chrome.tabs) return null;
  const host = new URL(VINTED_WEB_URL).host;
  const tabs = await chrome.tabs.query({ url: `*://${host}/*` });
  // Any live (not discarded) tab can run the script; Vinted's pages often
  // never settle into status "complete", so only prefer one that has.
  const live = tabs.filter((t) => t.id !== undefined && !t.discarded);
  const tab = live.find((t) => t.status === "complete") ?? live[0];
  if (tab?.id === undefined) return null;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [url, headers],
    // Runs in the page's isolated world, so Vinted's API sees the website's
    // own origin, cookies and anti-bot state — exactly like the site's calls.
    func: async (target: string, hdrs: Record<string, string>) => {
      try {
        const res = await fetch(target, { credentials: "include", headers: hdrs });
        return { status: res.status, body: await res.text() };
      } catch (err) {
        return { status: 0, body: String(err) };
      }
    },
  });
  const result = injection?.result as RawResponse | undefined;
  return result ?? null;
};

/** Number of open Vinted tabs the "tab" transport could use (diagnostics). */
export async function countVintedTabs(): Promise<number> {
  if (typeof chrome === "undefined" || !chrome.tabs) return 0;
  const host = new URL(VINTED_WEB_URL).host;
  return (await chrome.tabs.query({ url: `*://${host}/*` })).length;
}

/** Whether to go through the tab first, remembered across service-worker
 * restarts (chrome.storage.session; cleared when the browser restarts). */
export interface TransportPreference {
  get(): Promise<boolean>;
  set(preferTab: boolean): Promise<void>;
}

const PREFER_TAB_KEY = "tb:vintedPreferTab";

export function createTransportPreference(): TransportPreference {
  const session = typeof chrome !== "undefined" ? chrome.storage?.session : undefined;
  let memory = false;
  if (!session) {
    return {
      get: async () => memory,
      set: async (v) => {
        memory = v;
      },
    };
  }
  return {
    get: async () => (await session.get(PREFER_TAB_KEY))[PREFER_TAB_KEY] === true,
    set: async (v) => {
      memory = v;
      await session.set({ [PREFER_TAB_KEY]: v });
    },
  };
}
