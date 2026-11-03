/** Transport mocks only; these tests never contact Cloudflare. */
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import handler from "../api/demo/ask.js";

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
