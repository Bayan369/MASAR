import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_unit_test_only");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network access forbidden in configuration tests");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Local SDK/configuration tests only; these never verify a hosted integration.
describe("Supabase client configuration", () => {
  it("imports and initializes a singleton without a network request", async () => {
    const { getSupabaseClient } = await import("./supabase");
    expect(getSupabaseClient()).toBe(getSupabaseClient());
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"])(
    "fails safely when %s is empty",
    async (name) => {
      vi.stubEnv(name, "   ");
      const { getSupabaseClient } = await import("./supabase");
      expect(() => getSupabaseClient()).toThrow("إعدادات Supabase غير مكتملة");
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each([
    "not-a-url",
    "http://example.supabase.co",
    "https://user:pass@example.supabase.co",
    "https://example.supabase.co/rest/v1",
    "https://example.supabase.co/?key=test",
  ])(
    "rejects an invalid or unsafe URL without including its value",
    async (url) => {
      vi.stubEnv("VITE_SUPABASE_URL", url);
      const { getSupabaseClient } = await import("./supabase");
      let message = "";
      try {
        getSupabaseClient();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(url);
      expect(message).not.toContain("sb_publishable_unit_test_only");
    },
  );
  it.each([
    "sb_secret_unit_test_only",
    "service_role",
    "header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
    "invalid-key",
  ])("rejects non-publishable keys without exposing them", async (key) => {
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);
    const { getSupabaseClient } = await import("./supabase");
    expect(() => getSupabaseClient()).toThrow("بصيغة publishable");
    try {
      getSupabaseClient();
    } catch (error) {
      if (key !== "service_role")
        expect((error as Error).message).not.toContain(key);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("can initialize after correcting previously missing configuration", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { getSupabaseClient } = await import("./supabase");
    expect(() => getSupabaseClient()).toThrow();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    expect(getSupabaseClient()).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
