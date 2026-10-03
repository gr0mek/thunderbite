import { describe, expect, it } from "vitest";
import {
  catalogHeaders,
  catalogUrl,
  classifyCatalogBody,
  codeForStatus,
  parseSetCookies,
  sessionFromCookies,
  summarize,
  type Attempt,
} from "../scripts/probe-lib.ts";

const at = (
  round: number,
  step: Attempt["step"],
  code: Attempt["code"],
  ms = 100,
): Attempt => ({
  ts: "2026-10-03T00:00:00Z",
  round,
  step,
  status: code === "OK" ? 200 : 403,
  ms,
  code,
});

describe("session cookies", () => {
  it("extracts the token and anon id and drops cookie attributes", () => {
    const jar = parseSetCookies([
      "access_token_web=tok123; Path=/; Domain=.vinted.pl; HttpOnly; Secure",
      "anon_id=anon-1; Path=/",
      "datadome=dd=x; Max-Age=31536000",
      "garbage",
    ]);
    const s = sessionFromCookies(jar);
    expect(s.token).toBe("tok123");
    expect(s.anonId).toBe("anon-1");
    expect(s.cookieHeader).toBe("access_token_web=tok123; anon_id=anon-1; datadome=dd=x");
  });

  it("sends bearer, anon id, origin and a browser user agent", () => {
    const h = catalogHeaders({ token: "t", anonId: "a", cookieHeader: "x=1" });
    expect(h.Authorization).toBe("Bearer t");
    expect(h["x-anon-id"]).toBe("a");
    expect(h.Origin).toBe("https://www.vinted.pl");
    expect(h.Cookie).toBe("x=1");
    expect(h["User-Agent"]).toMatch(/Chrome/);
  });

  it("omits auth headers without a session", () => {
    const h = catalogHeaders({ cookieHeader: "" });
    expect(h.Authorization).toBeUndefined();
    expect(h.Cookie).toBeUndefined();
  });
});

describe("catalogUrl", () => {
  it("builds the svc-catalogue query and leaves out an empty search", () => {
    expect(catalogUrl("https://api.vinted.pl", " nike ")).toBe(
      "https://api.vinted.pl/svc-catalogue/items?search_text=nike&order=newest_first&page=1&per_page=20",
    );
    expect(catalogUrl("https://api.vinted.pl", "")).not.toContain("search_text");
  });
});

describe("classification", () => {
  it("maps statuses to the extension's error codes", () => {
    expect([401, 403, 404, 429, 503, 418].map(codeForStatus)).toEqual([
      "VNT-401",
      "VNT-403",
      "VNT-404",
      "VNT-429",
      "VNT-5XX",
      "VNT-HTTP",
    ]);
  });

  it("tells items, empty pages, wrong shapes and HTML challenges apart", () => {
    expect(classifyCatalogBody('{"items":[{},{}]}')).toEqual({ code: "OK", items: 2 });
    expect(classifyCatalogBody('{"items":[]}')).toEqual({ code: "VNT-EMPTY", items: 0 });
    expect(classifyCatalogBody('{"error":"x"}')).toEqual({ code: "VNT-SHAPE", items: 0 });
    expect(classifyCatalogBody("<html>captcha</html>")).toEqual({
      code: "VNT-JSON",
      items: 0,
    });
  });
});

describe("summarize", () => {
  it("judges a round by its last catalogue attempt", () => {
    // Round 1: 403, refreshed, then OK → counts as OK.
    const s = summarize([
      at(1, "session", "OK"),
      at(1, "catalog", "VNT-403"),
      at(1, "session", "OK"),
      at(1, "catalog", "OK", 300),
      at(2, "catalog", "OK", 100),
    ]);
    expect(s.rounds).toBe(2);
    expect(s.okRounds).toBe(2);
    expect(s.verdict).toBe("OK");
    expect(s.medianCatalogMs).toBe(300);
    expect(s.codes["catalog:VNT-403"]).toBe(1);
  });

  it("counts the longest failure streak and grades the verdict", () => {
    const codes: Attempt["code"][] = [
      "OK",
      "VNT-403",
      "VNT-403",
      "VNT-403",
      "OK",
      "VNT-429",
    ];
    const s = summarize(codes.map((c, i) => at(i + 1, "catalog", c)));
    expect(s.longestFailureStreak).toBe(3);
    expect(s.successRate).toBeCloseTo(2 / 6);
    expect(s.verdict).toBe("BLOCKED");
  });

  it("treats a round whose session failed and never reached the catalogue as failed", () => {
    const s = summarize([at(1, "session", "VNT-403"), at(2, "catalog", "OK")]);
    expect(s.rounds).toBe(2);
    expect(s.okRounds).toBe(1);
    expect(s.verdict).toBe("BLOCKED");
  });

  it("reports a connection problem, not a block, when Vinted never answered", () => {
    expect(
      summarize([at(1, "session", "VNT-NET"), at(1, "catalog", "VNT-NET")]).verdict,
    ).toBe("NO-CONNECTION");
    expect(
      summarize([at(1, "catalog", "VNT-TIMEOUT"), at(2, "catalog", "VNT-403")]).verdict,
    ).toBe("BLOCKED");
  });

  it("has no verdict without data", () => {
    expect(summarize([]).verdict).toBe("NO-DATA");
  });
});
