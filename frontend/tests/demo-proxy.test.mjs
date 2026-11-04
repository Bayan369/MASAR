/** Transport mocks only; these tests never contact Cloudflare. */
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import handler from "../api/demo/ask.js";
import documentHandler from "../api/demo/documents/[id].js";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.MASAR_DEMO_BACKEND_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.MASAR_DEMO_BACKEND_URL;
  else process.env.MASAR_DEMO_BACKEND_URL = originalUrl;
});
function response() {
  return {
    headers: {},
    code: 0,
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
test("unconfigured proxy fails closed without remote requests", async () => {
  delete process.env.MASAR_DEMO_BACKEND_URL;
  globalThis.fetch = () => {
    throw new Error("Must not call network");
  };
  const res = response();
  await handler({ method: "POST", body: { question: "سؤال عربي" } }, res);
  assert.equal(res.code, 503);
  assert.equal(res.body.answer, undefined);
});
test("proxy forwards only the question to configured HTTPS origin", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://backend.example/api/v1/demo/ask");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(options.body), { question: "سؤال عربي" });
    assert.equal(options.redirect, "error");
    return new globalThis.Response(
      JSON.stringify({
        status: "answered",
        answer: "الإجازة السنوية — إجابة اختبار فقط",
        sources: [{ title: "سياسة الإجازات", quote: "مقتطف عربي للاختبار" }],
      }),
    );
  };
  const res = response();
  await handler(
    {
      method: "POST",
      headers: {
        authorization: "never-forward",
        "x-forwarded-for": "untrusted",
      },
      body: { question: "سؤال عربي", token: "never-forward" },
    },
    res,
  );
  assert.equal(res.code, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(res.body.answer, "الإجازة السنوية — إجابة اختبار فقط");
  assert.equal(res.body.sources[0].quote, "مقتطف عربي للاختبار");
});
test("upstream failure is sanitized, never substituted", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async () =>
    new globalThis.Response("private-upstream-details", { status: 503 });
  const res = response();
  await handler({ method: "POST", body: { question: "سؤال عربي" } }, res);
  assert.equal(res.code, 502);
  assert.equal(res.body.answer, undefined);
  assert.ok(!JSON.stringify(res.body).includes("private-upstream-details"));
});
test("rate limits preserve 429 and reject non-POST methods", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async () => new globalThis.Response("", { status: 429 });
  const res = response();
  await handler({ method: "POST", body: { question: "سؤال عربي" } }, res);
  assert.equal(res.code, 429);
  assert.equal(res.headers["Retry-After"], "60");
  await handler({ method: "GET" }, res);
  assert.equal(res.code, 405);
});

test("proxy forwards the same bounded conversation context", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  const history = [
    { role: "user", content: "ما هي سياسة الإجازات؟" },
    { role: "assistant", content: "هل تريد معرفة الخطوة التالية؟" },
  ];
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { question: "إيه", history });
    return new globalThis.Response(
      JSON.stringify({
        status: "not_found",
        answer: "لا يوجد مصدر",
        sources: [],
      }),
    );
  };
  const res = response();
  await handler({ method: "POST", body: { question: "إيه", history } }, res);
  assert.equal(res.code, 200);
});

test("proxy rejects overlong or privileged history without remote requests", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = () => {
    throw new Error("Must not call network");
  };
  for (const history of [
    [{ role: "system", content: "untrusted" }],
    [{ role: "user", content: "x".repeat(2001) }],
    Array(11).fill({ role: "user", content: "x" }),
  ]) {
    const res = response();
    await handler({ method: "POST", body: { question: "إيه", history } }, res);
    assert.equal(res.code, 422);
  }
});

test("document proxy reads the original UTF-8 source from the fixed Backend", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async (url, options) => {
    assert.equal(
      String(url),
      "https://backend.example/api/v1/demo/documents/leave-policy",
    );
    assert.equal(options.redirect, "error");
    return new globalThis.Response("# سياسة الإجازات\nنص مصدر للاختبار.");
  };
  const res = response();
  await documentHandler({ method: "GET", query: { id: "leave-policy" } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers["Content-Type"], "text/plain; charset=utf-8");
  assert.equal(res.body, "# سياسة الإجازات\nنص مصدر للاختبار.");
});

test("document proxy rejects traversal and never leaks failed upstream content", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = () => {
    throw new Error("Must not call network");
  };
  const res = response();
  await documentHandler({ method: "GET", query: { id: "../private" } }, res);
  assert.equal(res.code, 400);
  globalThis.fetch = async () =>
    new globalThis.Response("PRIVATE_UPSTREAM_ERROR", { status: 503 });
  await documentHandler({ method: "GET", query: { id: "leave-policy" } }, res);
  assert.equal(res.code, 502);
  assert.ok(!JSON.stringify(res.body).includes("PRIVATE_UPSTREAM_ERROR"));
});

test("proxy preserves safe search failure code without forwarding private upstream messages", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async () =>
    new globalThis.Response(
      JSON.stringify({
        error: {
          code: "AI_SEARCH_INVALID",
          message: "PRIVATE_DOCUMENT_OR_TOKEN",
          headers: "PRIVATE_HEADERS",
        },
      }),
      { status: 502 },
    );
  const res = response();
  await handler({ method: "POST", body: { question: "سؤال عربي" } }, res);
  assert.equal(res.code, 502);
  assert.equal(res.body.error.code, "AI_SEARCH_INVALID");
  assert.ok(!JSON.stringify(res.body).includes("PRIVATE_"));
});

test("proxy keeps configuration errors distinct from malformed upstream responses", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async () =>
    new globalThis.Response(
      JSON.stringify({
        error: { code: "AI_NOT_CONFIGURED", message: "private" },
      }),
      { status: 503 },
    );
  const res = response();
  await handler({ method: "POST", body: { question: "سؤال عربي" } }, res);
  assert.equal(res.code, 503);
  assert.equal(res.body.error.code, "AI_NOT_CONFIGURED");
});

test("proxy distinguishes incomplete assessments without exposing upstream data", async () => {
  process.env.MASAR_DEMO_BACKEND_URL = "https://backend.example";
  globalThis.fetch = async () =>
    new globalThis.Response(
      JSON.stringify({
        error: {
          code: "AI_SEARCH_INCOMPLETE",
          message: "PRIVATE_CANDIDATE_CONTENT",
        },
      }),
      { status: 502 },
    );
  const res = response();
  await handler({ method: "POST", body: { question: "طلب إجراء عام" } }, res);
  assert.equal(res.code, 502);
  assert.equal(res.body.error.code, "AI_SEARCH_INCOMPLETE");
  assert.ok(!JSON.stringify(res.body).includes("PRIVATE_"));
  assert.equal(res.body.answer, undefined);
});
