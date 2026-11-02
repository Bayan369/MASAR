import { expect, test } from "@playwright/test";
// Real local API; no hosted requests or authentication substitutes.
test("real FastAPI denies anonymous data and inference", async ({
  request,
}) => {
  for (const path of ["/me", "/documents", "/conversations"])
    expect(
      (await request.get("http://127.0.0.1:8000/api/v1" + path)).status(),
    ).toBe(401);
  const r = await request.post("http://127.0.0.1:8000/api/v1/assistant/ask", {
    data: { question: "VPN instructions?" },
  });
  expect(r.status()).toBe(401);
  expect((await r.json()).error.code).toBe("AUTH_REQUIRED");
  expect(
    (await request.get("http://127.0.0.1:8000/api/v1/demo/documents")).status(),
  ).toBe(404);
});
