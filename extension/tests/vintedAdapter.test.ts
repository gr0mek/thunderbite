import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/vinted/catalog-items.json";
import { buildCatalogParams, normalizeItem } from "@/adapters/vinted/api";
import { createVintedAdapter, VintedHttpError } from "@/adapters/vinted";

// The fixture is hand-written to the item fields the reference client
// (Vinted-Notifications' pyVintedVN) reads — not a captured response, see
// docs/adr-003-vinted-adapter.md.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("createVintedAdapter", () => {
  it("searches each keyword and merges results without duplicates", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(fixture));
    const adapter = createVintedAdapter({ fetch: fetchMock, sleep: noSleep });
    const offers = await adapter.search(
      { keywords: ["nike", "acg", "nike "], excludeKeywords: [], priceMax: 300 },
      new AbortController().signal,
    );
    expect(offers.map((o) => o.externalId)).toEqual(["4812345678", "4812345679"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.vinted.pl/api/v2/catalog/items",
    );
    expect(parsed.searchParams.get("price_to")).toBe("300");
    expect(init.credentials).toBe("include");
  });

  it("refreshes the session on 401 and retries", async () => {
    const fetchMock = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // HEAD /
      .mockResolvedValueOnce(jsonResponse(fixture));
    const adapter = createVintedAdapter({
      fetch: fetchMock as typeof fetch,
      sleep: noSleep,
    });
    const offers = await adapter.search(
      { keywords: ["nike"], excludeKeywords: [] },
      new AbortController().signal,
    );
    expect(offers).toHaveLength(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://www.vinted.pl/");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("HEAD");
  });

  it("throws a VintedHttpError on non-retryable errors", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429 }));
    const adapter = createVintedAdapter({ fetch: fetchMock, sleep: noSleep });
    await expect(
      adapter.search(
        { keywords: ["nike"], excludeKeywords: [] },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(VintedHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after repeated 401s", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    const adapter = createVintedAdapter({ fetch: fetchMock, sleep: noSleep });
    await expect(
      adapter.search(
        { keywords: ["nike"], excludeKeywords: [] },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 401 });
    // 3 catalog attempts + 2 session refreshes in between.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects an unexpected response shape", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "x" }));
    const adapter = createVintedAdapter({ fetch: fetchMock, sleep: noSleep });
    await expect(
      adapter.search(
        { keywords: ["nike"], excludeKeywords: [] },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/shape/);
  });

  it("reports health from a latest-listings request", async () => {
    const ok = createVintedAdapter({ fetch: vi.fn(async () => jsonResponse(fixture)) });
    expect(await ok.healthCheck()).toBe("ok");
    const empty = createVintedAdapter({
      fetch: vi.fn(async () => jsonResponse({ items: [] })),
    });
    expect(await empty.healthCheck()).toBe("degraded");
    const down = createVintedAdapter({
      fetch: vi.fn(async () => new Response("", { status: 403 })),
    });
    expect(await down.healthCheck()).toBe("broken");
  });
});
