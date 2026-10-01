// How a single HTTP request to Vinted is actually made. Two transports:
//
// - "sw": a plain fetch() from the extension's service worker. Cheapest,
//   needs no open tab, but Vinted sees an extension-originated request
//   (background/vintedHeaders.ts strips the tell-tale Origin header).
// - "tab": the same fetch() executed inside an open www.vinted.pl tab via
//   chrome.scripting — a genuine same-origin request with the page's own
//   cookies and anti-bot state. Used when the service-worker request is
//   refused (see ./index.ts).

import { VINTED_BASE_URL } from "./api";

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

export type SwFetch = (url: string, init: RequestInit) => Promise<RawResponse>;

export const swFetch: SwFetch = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
};

/**
 * Runs `url` through an already-open, fully loaded Vinted tab. Resolves to
 * null when there is no such tab — this never opens one on its own.
 */
export type TabFetch = (url: string) => Promise<RawResponse | null>;

export const tabFetch: TabFetch = async (url) => {
  if (typeof chrome === "undefined" || !chrome.scripting || !chrome.tabs) return null;
  const host = new URL(VINTED_BASE_URL).host;
  const tabs = await chrome.tabs.query({ url: `*://${host}/*` });
  const tab = tabs.find(
    (t) => t.id !== undefined && !t.discarded && t.status === "complete",
  );
  if (tab?.id === undefined) return null;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [url, REQUEST_HEADERS],
    // Runs in the page's isolated world: a same-origin fetch for Vinted.
    func: async (target: string, headers: Record<string, string>) => {
      try {
        const res = await fetch(target, { credentials: "include", headers });
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
  const host = new URL(VINTED_BASE_URL).host;
  return (await chrome.tabs.query({ url: `*://${host}/*` })).length;
}
