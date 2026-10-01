import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/vinted/catalog-items.json";
import { buildCatalogParams, normalizeItem } from "@/adapters/vinted/api";
import { createVintedAdapter } from "@/adapters/vinted";
import type { RawResponse, SwFetch, TabFetch } from "@/adapters/vinted/transport";
import type { RequestTrace } from "@/shared/schemas";
import { ScanError } from "@/shared/scanErrors";

// The fixture is hand-written to the item fields the reference client
// (Vinted-Notifications' pyVintedVN) reads — not a captured response, see
// docs/adr-003-vinted-adapter.md.

const noSleep = () => Promise.resolve();

describe("buildCatalogParams", () => {
  it("always asks for the newest listings first", () => {
    const p = buildCatalogParams("nike", {});
    expect(p.get("search_text")).toBe("nike");
    expect(p.get("order")).toBe("newest_first");
    expect(p.get("page")).toBe("1");
    expect(p.has("price_from")).toBe(false);
    expect(p.has("status_ids")).toBe(false);
  });

  it("maps price range and condition", () => {
    const p = buildCatalogParams("nike", {
      priceMin: 10,
      priceMax: 200,
      condition: "used",
    });
    expect(p.get("price_from")).toBe("10");
    expect(p.get("price_to")).toBe("200");
    expect(p.get("status_ids")).toBe("2,3,4");
    expect(buildCatalogParams("x", { condition: "new" }).get("status_ids")).toBe("6,1");
    expect(buildCatalogParams("x", { condition: "any" }).has("status_ids")).toBe(false);
  });
});

describe("normalizeItem", () => {
  it("normalizes an item with an object price and photo timestamp", () => {
    expect(normalizeItem(fixture.items[0])).toEqual({
      site: "vinted",
      externalId: "4812345678",
      url: "https://www.vinted.pl/items/4812345678-kurtka-nike-acg",
      title: "Kurtka Nike ACG rozmiar M",
      price: 149,
      currency: "PLN",
      imageUrl: "https://images1.vinted.net/t/01_abc/f800/1.jpeg",
      postedAt: new Date(1790000000 * 1000).toISOString(),
      seller: { name: "anna_k", rating: 0.98 },
    });
  });

  it("handles a string price, relative URL and missing photo", () => {
    const offer = normalizeItem(fixture.items[1]);
    expect(offer).toMatchObject({
      externalId: "4812345679",
      url: "https://www.vinted.pl/items/4812345679-bluza-nike-tech-fleece",
      price: 89.5,
      currency: "PLN",
    });
    expect(offer?.imageUrl).toBeUndefined();
    expect(offer?.postedAt).toBeUndefined();
  });

  it("drops items missing required fields", () => {
    expect(normalizeItem(fixture.items[2])).toBeNull();
    expect(normalizeItem("nope")).toBeNull();
  });

  it("only attaches raw data in debug mode", () => {
    expect(normalizeItem(fixture.items[0])?.raw).toBeUndefined();
    expect(normalizeItem(fixture.items[0], undefined, true)?.raw).toBe(fixture.items[0]);
  });
});

type SwCall = [string, RequestInit];

function swReturning(...responses: Array<RawResponse | Error>) {
  const queue = [...responses];
  const calls: SwCall[] = [];
  const fn: SwFetch = async (url, init) => {
    calls.push([url, init]);
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next instanceof Error) throw next;
    return next;
  };
  return { fn, calls };
}

const ok = (body: unknown = fixture): RawResponse => ({
  status: 200,
  body: JSON.stringify(body),
});
const status = (code: number, body = ""): RawResponse => ({ status: code, body });
const query = { keywords: ["nike"], excludeKeywords: [] };
const signal = () => new AbortController().signal;

describe("createVintedAdapter", () => {
  it("searches each keyword and merges results without duplicates", async () => {
    const sw = swReturning(ok());
    const adapter = createVintedAdapter({
      swFetch: sw.fn,
      tabFetch: null,
      sleep: noSleep,
    });
    const offers = await adapter.search(
      { keywords: ["nike", "acg", "nike "], excludeKeywords: [], priceMax: 300 },
      signal(),
    );
    expect(offers.map((o) => o.externalId)).toEqual(["4812345678", "4812345679"]);
    expect(sw.calls).toHaveLength(2);
    const [url, init] = sw.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.vinted.pl/api/v2/catalog/items",
    );
    expect(parsed.searchParams.get("price_to")).toBe("300");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["Accept-Language"]).toMatch(/^pl/);
  });

  it("refreshes the session on 401 and retries, tracing every request", async () => {
    const sw = swReturning(status(401), status(200, "<html>"), ok());
    const traces: RequestTrace[] = [];
    const adapter = createVintedAdapter({
      swFetch: sw.fn,
      tabFetch: null,
      sleep: noSleep,
    });
    const offers = await adapter.search(query, signal(), (t) => traces.push(t));
    expect(offers).toHaveLength(2);
    expect(sw.calls[1]?.[0]).toBe("https://www.vinted.pl/");
    expect(traces.map((t) => [t.via, t.attempt, t.status, t.code])).toEqual([
      ["sw", 1, 401, "VNT-401"],
      ["sw", 2, 200, undefined],
    ]);
    expect(traces[1]?.items).toBe(3); // raw API items, incl. the malformed one
  });

  it("maps failures to stable error codes", async () => {
    const cases: Array<[RawResponse | Error, string]> = [
      [status(429), "VNT-429"],
      [status(503), "VNT-5XX"],
      [status(418), "VNT-HTTP"],
      [status(200, "<html>captcha</html>"), "VNT-JSON"],
      [ok({ error: "x" }), "VNT-SHAPE"],
      [new TypeError("Failed to fetch"), "VNT-NET"],
    ];
    for (const [response, code] of cases) {
      const adapter = createVintedAdapter({
        swFetch: swReturning(response).fn,
        tabFetch: null,
        sleep: noSleep,
      });
      const err = await adapter.search(query, signal()).catch((e: unknown) => e);
      expect(err, code).toBeInstanceOf(ScanError);
      expect((err as ScanError).code, code).toBe(code);
    }
  });

  it("keeps the start of an anti-bot page in the trace", async () => {
    const traces: RequestTrace[] = [];
    const adapter = createVintedAdapter({
      swFetch: swReturning(status(403, "<html>  Please enable JS  </html>")).fn,
      tabFetch: null,
    });
    await expect(
      adapter.search(query, signal(), (t) => traces.push(t)),
    ).rejects.toMatchObject({
      code: "VNT-403",
    });
    expect(traces[0]?.snippet).toBe("<html> Please enable JS </html>");
  });

  it("gives up after repeated 401s", async () => {
    const sw = swReturning(status(401));
    const adapter = createVintedAdapter({
      swFetch: sw.fn,
      tabFetch: null,
      sleep: noSleep,
    });
    await expect(adapter.search(query, signal())).rejects.toMatchObject({
      code: "VNT-401",
    });
    // 3 catalog attempts + 2 session refreshes in between.
    expect(sw.calls).toHaveLength(5);
  });

  it("times out a hanging request with VNT-TIMEOUT", async () => {
    const hanging: SwFetch = (_url, init) =>
      new Promise((_, reject) =>
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      );
    const adapter = createVintedAdapter({
      swFetch: hanging,
      tabFetch: null,
      requestTimeoutMs: 10,
    });
    await expect(adapter.search(query, signal())).rejects.toMatchObject({
      code: "VNT-TIMEOUT",
    });
  });

  it("falls back to an open Vinted tab when the service worker is blocked", async () => {
    const sw = swReturning(status(403));
    const tabFetch = vi.fn<TabFetch>(async () => ok());
    const traces: RequestTrace[] = [];
    const adapter = createVintedAdapter({ swFetch: sw.fn, tabFetch, sleep: noSleep });

    const offers = await adapter.search(query, signal(), (t) => traces.push(t));
    expect(offers).toHaveLength(2);
    expect(traces.map((t) => [t.via, t.status])).toEqual([
      ["sw", 403],
      ["tab", 200],
    ]);

    // Next time the tab goes first; the service worker isn't even tried.
    await adapter.search(query, signal());
    expect(sw.calls).toHaveLength(1);
    expect(tabFetch).toHaveBeenCalledTimes(2);
  });

  it("explains a block when no Vinted tab is open", async () => {
    const traces: RequestTrace[] = [];
    const adapter = createVintedAdapter({
      swFetch: swReturning(status(403)).fn,
      tabFetch: async () => null,
    });
    const err = (await adapter
      .search(query, signal(), (t) => traces.push(t))
      .catch((e: unknown) => e)) as ScanError;
    expect(err.code).toBe("VNT-403");
    expect(err.message).toMatch(/no usable vinted\.pl tab/);
    expect(traces.at(-1)).toMatchObject({ via: "tab", note: "no usable vinted.pl tab" });
  });

  it("treats Vinted's unauthenticated 404 page as a reason to use the tab", async () => {
    const sw = swReturning(
      status(404, "<!DOCTYPE html><title>La page n'existe pas</title>"),
    );
    const tabFetch = vi.fn<TabFetch>(async () => ok());
    const adapter = createVintedAdapter({ swFetch: sw.fn, tabFetch, sleep: noSleep });
    expect(await adapter.search(query, signal())).toHaveLength(2);
    // 3 catalog attempts + 2 session refreshes, then the tab.
    expect(sw.calls).toHaveLength(5);
    expect(tabFetch).toHaveBeenCalledTimes(1);
  });

  it("remembers the tab preference across service-worker restarts", async () => {
    let stored = false;
    const preference = {
      get: async () => stored,
      set: async (v: boolean) => {
        stored = v;
      },
    };
    const tabFetch = vi.fn<TabFetch>(async () => ok());
    const first = createVintedAdapter({
      swFetch: swReturning(status(401)).fn,
      tabFetch,
      preference,
      sleep: noSleep,
    });
    await first.search(query, signal());
    expect(stored).toBe(true);

    // A fresh adapter (new worker) goes straight to the tab.
    const sw = swReturning(status(401));
    const second = createVintedAdapter({ swFetch: sw.fn, tabFetch, preference });
    await second.search(query, signal());
    expect(sw.calls).toHaveLength(0);
  });

  it("does not fall back on rate limiting", async () => {
    const tabFetch = vi.fn<TabFetch>(async () => ok());
    const adapter = createVintedAdapter({
      swFetch: swReturning(status(429)).fn,
      tabFetch,
    });
    await expect(adapter.search(query, signal())).rejects.toMatchObject({
      code: "VNT-429",
    });
    expect(tabFetch).not.toHaveBeenCalled();
  });

  it("reports health from a latest-listings request", async () => {
    const healthy = createVintedAdapter({
      swFetch: swReturning(ok()).fn,
      tabFetch: null,
    });
    expect(await healthy.healthCheck()).toBe("ok");
    const empty = createVintedAdapter({
      swFetch: swReturning(ok({ items: [] })).fn,
      tabFetch: null,
    });
    expect(await empty.healthCheck()).toBe("degraded");
    const traces: RequestTrace[] = [];
    const down = createVintedAdapter({
      swFetch: swReturning(status(403)).fn,
      tabFetch: null,
    });
    expect(await down.healthCheck((t) => traces.push(t))).toBe("broken");
    expect(traces[0]?.code).toBe("VNT-403");
  });
});
