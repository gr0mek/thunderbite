import { describe, expect, it } from "vitest";
import fixture from "./fixtures/ebay/item-summary-search.json";
import { buildQueryTexts, buildSearchParams, normalizeItem } from "@/adapters/ebay/api";
import { createEbayAdapter } from "@/adapters/ebay";
import type { HttpFetch, HttpResponse } from "@/adapters/ebay/auth";
import { MemoryStore } from "@/storage/local";
import type { RequestTrace } from "@/shared/schemas";
import { ScanError } from "@/shared/scanErrors";

// The fixture is hand-written to the Browse API's documented ItemSummary
// fields — not a captured response, see docs/adr-007-ebay-adapter.md.

const creds = { clientId: "MyApp-PRD-123", clientSecret: "PRD-secret" };
const noSleep = () => Promise.resolve();
const signal = () => new AbortController().signal;

describe("buildQueryTexts", () => {
  it("ORs single words into one query", () => {
    expect(buildQueryTexts(["nikon", "canon", "nikon "])).toEqual(["(nikon,canon)"]);
    expect(buildQueryTexts(["leica"])).toEqual(["leica"]);
  });

  it("gives each multi-word keyword its own query", () => {
    expect(buildQueryTexts(["leica m6", "contax", "olympus mju"])).toEqual([
      "contax",
      "leica m6",
      "olympus mju",
    ]);
  });

  it("strips eBay's query operators from keywords", () => {
    expect(buildQueryTexts(['"mju" (ii)', "a,b"])).toEqual(["mju ii", "a b"]);
  });
});

describe("buildSearchParams", () => {
  it("asks for the newest listings that ship to Poland", () => {
    const p = buildSearchParams("leica", {});
    expect(p.get("q")).toBe("leica");
    expect(p.get("sort")).toBe("newlyListed");
    expect(p.get("limit")).toBe("50");
    expect(p.get("filter")).toBe("deliveryCountry:PL");
  });

  it("maps price range (USD) and condition", () => {
    expect(
      buildSearchParams("x", { priceMin: 10, priceMax: 500, condition: "used" }).get(
        "filter",
      ),
    ).toBe("deliveryCountry:PL,price:[10..500],priceCurrency:USD,conditions:{USED}");
    expect(buildSearchParams("x", { priceMax: 50 }).get("filter")).toContain(
      "price:[..50]",
    );
    expect(buildSearchParams("x", { priceMin: 10 }).get("filter")).toContain(
      "price:[10]",
    );
    expect(buildSearchParams("x", { condition: "new" }).get("filter")).toContain(
      "conditions:{NEW}",
    );
  });

  it("caps the page at 200 (deal-mode seeding asks for 96)", () => {
    expect(buildSearchParams("x", { limit: 96 }).get("limit")).toBe("96");
    expect(buildSearchParams("x", { limit: 500 }).get("limit")).toBe("200");
  });
});

describe("normalizeItem", () => {
  it("normalizes a fixed-price listing with the cheapest shipping to PL", () => {
    expect(normalizeItem(fixture.itemSummaries[0])).toEqual({
      site: "ebay",
      externalId: "306012345678",
      url: "https://www.ebay.com/itm/306012345678",
      title: "Leica M6 TTL 0.72 Black Film Camera Body",
      price: 2450,
      currency: "USD",
      imageUrl: "https://i.ebayimg.com/images/g/abc/s-l225.jpg",
      postedAt: "2026-10-02T09:41:12.000Z",
      location: "US",
      shippingCost: 38.5,
      seller: { name: "camerastore", rating: 99.8 },
    });
  });

  it("marks an auction and prices it at the current bid", () => {
    expect(normalizeItem(fixture.itemSummaries[1])).toMatchObject({
      externalId: "186098765432",
      price: 152.5,
      shippingCost: 0,
      auction: { endsAt: "2026-10-04T18:00:00.000Z", bidCount: 7 },
    });
  });

  it("falls back to the itemId and leaves unknown shipping out", () => {
    const offer = normalizeItem(fixture.itemSummaries[2]);
    expect(offer?.externalId).toBe("405011112222");
    expect(offer?.shippingCost).toBeUndefined();
    expect(offer?.auction).toBeUndefined();
  });

  it("drops unusable items", () => {
    expect(normalizeItem({ itemId: "v1|1|0", title: "x" })).toBeNull();
    expect(normalizeItem(null)).toBeNull();
  });
});

const tokenOk: HttpResponse = {
  status: 200,
  body: JSON.stringify({ access_token: "app-token", expires_in: 7200 }),
};
const searchOk: HttpResponse = { status: 200, body: JSON.stringify(fixture) };

function http(...responses: Array<HttpResponse | Error>) {
  const queue = [...responses];
  const calls: { url: string; init: Parameters<HttpFetch>[1] }[] = [];
  const fn: HttpFetch = async (url, init) => {
    calls.push({ url, init });
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next instanceof Error) throw next;
    return next;
  };
  return { fn, calls };
}

function adapter(fetch: HttpFetch, opts: { keys?: typeof creds | null } = {}) {
  return createEbayAdapter({
    readCredentials: async () => (opts.keys === null ? undefined : (opts.keys ?? creds)),
    http: fetch,
    tokenCache: new MemoryStore(),
    sleep: noSleep,
  });
}

describe("createEbayAdapter", () => {
  it("gets an application token, then searches ebay.com as a buyer in Poland", async () => {
    const h = http(tokenOk, searchOk);
    const offers = await adapter(h.fn).search(
      { keywords: ["leica"], excludeKeywords: [] },
      signal(),
    );
    expect(offers.map((o) => o.externalId)).toEqual([
      "306012345678",
      "186098765432",
      "405011112222",
    ]);

    const [token, search] = h.calls;
    expect(token!.url).toBe("https://api.ebay.com/identity/v1/oauth2/token");
    expect(token!.init.method).toBe("POST");
    expect(token!.init.headers!.Authorization).toBe(
      `Basic ${btoa("MyApp-PRD-123:PRD-secret")}`,
    );
    expect(token!.init.body).toBe(
      "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    );

    const url = new URL(search!.url);
    expect(url.origin + url.pathname).toBe(
      "https://api.ebay.com/buy/browse/v1/item_summary/search",
    );
    expect(url.searchParams.get("q")).toBe("leica");
    expect(search!.init.headers).toMatchObject({
      Authorization: "Bearer app-token",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DPL",
    });
  });

  it("reuses the cached token across searches", async () => {
    const h = http(tokenOk, searchOk);
    const a = adapter(h.fn);
    await a.search({ keywords: ["leica"], excludeKeywords: [] }, signal());
    await a.search({ keywords: ["leica"], excludeKeywords: [] }, signal());
    expect(h.calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
  });

  it("renews the token once on a 401, tracing every request", async () => {
    const h = http(tokenOk, { status: 401, body: "{}" }, tokenOk, searchOk);
    const traces: RequestTrace[] = [];
    const offers = await adapter(h.fn).search(
      { keywords: ["leica"], excludeKeywords: [] },
      signal(),
      (t) => traces.push(t),
    );
    expect(offers).toHaveLength(3);
    expect(traces.map((t) => [t.status, t.code, t.note])).toEqual([
      [200, undefined, "token"],
      [401, "EBY-401", "token refresh + retry"],
      [200, undefined, "token"],
      [200, undefined, undefined],
    ]);
  });

  it("fails with EBY-KEYS when no keyset is saved", async () => {
    const h = http(searchOk);
    const a = adapter(h.fn, { keys: null });
    await expect(
      a.search({ keywords: ["leica"], excludeKeywords: [] }, signal()),
    ).rejects.toMatchObject({ code: "EBY-KEYS" });
    expect(h.calls).toHaveLength(0);
    expect(await a.isConfigured!()).toBe(false);
  });

  it("reports rejected keys as EBY-AUTH", async () => {
    const h = http({ status: 401, body: '{"error":"invalid_client"}' });
    const err = await adapter(h.fn)
      .search({ keywords: ["leica"], excludeKeywords: [] }, signal())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScanError);
    expect((err as ScanError).code).toBe("EBY-AUTH");
  });

  it("reports the daily quota as EBY-429 with eBay's error id", async () => {
    const h = http(tokenOk, {
      status: 429,
      body: JSON.stringify({ errors: [{ errorId: 2001, message: "Too many requests" }] }),
    });
    const traces: RequestTrace[] = [];
    const err = await adapter(h.fn)
      .search({ keywords: ["leica"], excludeKeywords: [] }, signal(), (t) =>
        traces.push(t),
      )
      .catch((e: unknown) => e);
    expect((err as ScanError).code).toBe("EBY-429");
    expect(traces.at(-1)?.note).toBe("errorId 2001: Too many requests");
  });

  it("times out a hanging token request as EBY-TIMEOUT", async () => {
    const hang: HttpFetch = (_url, init) =>
      new Promise((_, reject) =>
        init.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
      );
    const a = createEbayAdapter({
      readCredentials: async () => creds,
      http: hang,
      tokenCache: new MemoryStore(),
      requestTimeoutMs: 10,
    });
    await expect(
      a.search({ keywords: ["leica"], excludeKeywords: [] }, signal()),
    ).rejects.toMatchObject({ code: "EBY-TIMEOUT" });
  });

  it("treats a search without results as empty, not broken", async () => {
    const h = http(tokenOk, { status: 200, body: '{"total":0}' });
    const offers = await adapter(h.fn).search(
      { keywords: ["zzzz"], excludeKeywords: [] },
      signal(),
    );
    expect(offers).toEqual([]);
  });

  it("health check: ok with items, broken on errors", async () => {
    expect(await adapter(http(tokenOk, searchOk).fn).healthCheck()).toBe("ok");
    expect(await adapter(http(tokenOk, { status: 500, body: "" }).fn).healthCheck()).toBe(
      "broken",
    );
  });
});
