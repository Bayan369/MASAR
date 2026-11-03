import { afterEach, describe, expect, it, vi } from "vitest";
import { askLlama } from "./llama";

const context = { step: 0 };
afterEach(() => vi.unstubAllGlobals());
describe("Llama API adapter (mocked transport, not live inference)", () => {
  it("posts Arabic without auth and preserves source text", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "answered",
          answer: "إجابة اختبار فقط",
          sources: [{ title: "مصدر تجريبي", quote: "نص موثق" }],
          generated_by: "Cloudflare Workers AI / Llama",
          model: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const reply = await askLlama("كم مدة الإجازة؟", context);
    expect(reply.sources[0].quote).toBe("نص موثق");
    expect(fetch.mock.calls[0][0]).toBe("/api/demo/ask");
    expect(fetch.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
    });
  });
  it("does not substitute a local reply when the model fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "Llama غير متاح" } }),
            { status: 502 },
          ),
        ),
    );
    await expect(askLlama("كيف أطلب إجازة؟", context)).rejects.toThrow(
      "Llama غير متاح",
    );
  });
  it("rejects answered responses missing model provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "answered",
            answer: "غير موثق",
            sources: [],
          }),
        ),
      ),
    );
    await expect(askLlama("كيف أطلب إجازة؟", context)).rejects.toThrow("مصدر");
  });
  it("preserves a documented not-found without claiming model provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "not_found",
            answer: "لا تتوفر معلومة موثقة",
            sources: [],
          }),
        ),
      ),
    );
    expect((await askLlama("سؤال خارج الوثائق", context)).status).toBe(
      "unavailable",
    );
  });
});
