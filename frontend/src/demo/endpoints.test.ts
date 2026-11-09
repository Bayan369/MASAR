import { afterEach, describe, expect, it, vi } from "vitest";
import { demoApiUrl, demoSourceHref } from "./endpoints";

afterEach(() => vi.unstubAllEnvs());
describe("public Demo endpoint configuration", () => {
  it("retains the existing proxy when no origin is configured", () => {
    expect(demoApiUrl("/ask", "")).toBe("/api/demo/ask");
    expect(demoApiUrl("/documents/leave-policy", "")).toBe(
      "/api/demo/documents/leave-policy",
    );
  });
  it("uses the configured backend origin and real FastAPI paths", () => {
    expect(demoApiUrl("/ask", "https://api.example/")).toBe(
      "https://api.example/api/v1/demo/ask",
    );
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example");
    expect(demoSourceHref("/api/demo/documents/employee-handbook")).toBe(
      "https://api.example/api/v1/demo/documents/employee-handbook",
    );
  });
  it.each([
    "https://user:secret@api.example",
    "https://api.example/api",
    "https://api.example?key=private",
    "https://api.example/#secret",
    "http://api.example",
    "//api.example",
    "not-a-url",
  ])("rejects invalid origins without echoing input", (origin) => {
    expect(() => demoApiUrl("/ask", origin)).toThrow(
      "عنوان خدمة المساعد غير صالح",
    );
  });
  it("rejects production localhost and unsafe source paths", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("MODE", "production");
    expect(() => demoApiUrl("/ask", "http://localhost:8000")).toThrow();
    for (const source of [
      "https://evil.example/document",
      "javascript:alert(1)",
      "/api/demo/documents/../private",
      "/api/demo/documents/leave-policy?token=x",
      "/api/v1/me",
      undefined,
    ])
      expect(demoSourceHref(source)).toBeUndefined();
    expect(() => demoApiUrl("/../me", "https://api.example")).toThrow();
  });
});
