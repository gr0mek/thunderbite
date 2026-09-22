import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestEmailVerification,
  sendDailyDigestEmail,
  sendImmediateEmail,
} from "@/shared/backendClient";

describe("backendClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "https://example.functions.supabase.co");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts to request-verification with the email", async () => {
    await requestEmailVerification("foto@example.com");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://example.functions.supabase.co/request-verification");
    expect(JSON.parse(init.body)).toEqual({ email: "foto@example.com" });
  });

  it("posts an immediate-send payload shaped for the backend's EmailOfferSchema", async () => {
    await sendImmediateEmail("foto@example.com", {
      title: "Leica M6 czarna",
      price: 4200,
      site: "OLX",
      url: "https://olx.pl/oferta/1",
    });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(JSON.parse(init.body)).toEqual({
      email: "foto@example.com",
      kind: "immediate",
      offer: {
        title: "Leica M6 czarna",
        price: 4200,
        site: "OLX",
        url: "https://olx.pl/oferta/1",
      },
    });
  });

  it("throws a clear error instead of fetching when unconfigured", async () => {
    vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "");
    await expect(
      sendDailyDigestEmail("foto@example.com", { "Leica M6": [] }),
    ).rejects.toThrow(/not configured/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a failed send as a rejected promise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("email not verified"),
      }),
    );
    await expect(requestEmailVerification("foto@example.com")).rejects.toThrow(/403/);
  });
});
