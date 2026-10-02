import { describe, expect, it } from "vitest";
import { detectSearchContext } from "@/adapters/searchContext";

const detect = (url: string) => detectSearchContext("vinted", new URL(url), document);

describe("detectSearchContext", () => {
  it("reads search text and max price from a Vinted catalog URL", () => {
    expect(
      detect(
        "https://www.vinted.pl/catalog?search_text=nike%20acg&price_to=200&order=newest_first",
      ),
    ).toEqual({ query: "nike acg", priceMax: 200 });
    expect(detect("https://www.vinted.pl/catalog/?search_text=lego")).toEqual({
      query: "lego",
    });
  });

  it("ignores non-catalog pages and filter-only browsing", () => {
    expect(detect("https://www.vinted.pl/items/123-kurtka")).toBeNull();
    expect(detect("https://www.vinted.pl/catalog?brand_ids[]=53")).toBeNull();
    expect(detect("https://www.vinted.pl/catalog?search_text=%20%20")).toBeNull();
    expect(detect("https://www.vinted.pl/catalog?search_text=nike&price_to=abc")).toEqual(
      {
        query: "nike",
      },
    );
  });
});

describe("detectSearchContext on eBay", () => {
  const ebay = (url: string) => detectSearchContext("ebay", new URL(url), document);

  it("reads keywords and max price from a search URL", () => {
    expect(
      ebay("https://www.ebay.com/sch/i.html?_nkw=leica+m6&_sacat=0&_udhi=1500&_sop=10"),
    ).toEqual({ query: "leica m6", priceMax: 1500 });
    expect(ebay("https://www.ebay.com/sch/15230/i.html?_nkw=contax+t2")).toEqual({
      query: "contax t2",
    });
  });

  it("ignores item pages and searches without keywords", () => {
    expect(ebay("https://www.ebay.com/itm/306012345678")).toBeNull();
    expect(ebay("https://www.ebay.com/sch/i.html?_sacat=625")).toBeNull();
  });
});
