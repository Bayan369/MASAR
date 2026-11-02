import { afterEach, describe, expect, it, vi } from "vitest";
import { askAssistant, getDemoDocuments } from "./assistant";
afterEach(() => vi.unstubAllGlobals());
describe("assistant API client (offline contracts)", () => {
  it("sends only the question to the backend", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "not_found",
          answer: "لا توجد معلومة.",
          sources: [],
          demo: true,
          generated_by: null,
          model: null,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mock);
    const result = await askAssistant(
      "سؤال تجريبي",
      new AbortController().signal,
    );
    expect(result.status).toBe("not_found");
    const options = mock.mock.calls[0][1];
    expect(JSON.parse(options.body)).toEqual({ question: "سؤال تجريبي" });
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
  });
  it("preserves safe backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "AI_NOT_CONFIGURED", message: "خدمة غير مهيّأة." },
          }),
          { status: 503 },
        ),
      ),
    );
    await expect(
      askAssistant("سؤال", new AbortController().signal),
    ).rejects.toThrow("خدمة غير مهيّأة.");
  });
  it("replaces low-level network errors with Arabic feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("internal-network-detail")),
    );
    await expect(
      askAssistant("سؤال", new AbortController().signal),
    ).rejects.toThrow("تعذّر الاتصال بالخدمة الخلفية");
  });
  it("rejects malformed answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    await expect(
      askAssistant("سؤال", new AbortController().signal),
    ).rejects.toThrow("استجابة غير متوقعة");
  });
  it("loads document data from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            documents: [
              { id: "test-document", title: "وثيقة اختبار", sections: [] },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    expect((await getDemoDocuments(new AbortController().signal))[0].id).toBe(
      "test-document",
    );
  });
});
