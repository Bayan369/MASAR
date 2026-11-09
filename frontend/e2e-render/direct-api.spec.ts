import { expect, test } from "@playwright/test";

test("static frontend reaches actual cross-origin Demo routes and packaged documents without live AI", async ({
  page,
}) => {
  const api = "http://127.0.0.1:8018";
  await page.goto("/assistant");
  const preflight = await page.request.fetch(`${api}/api/v1/demo/ask`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:5178",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  expect(preflight.status()).toBe(200);
  expect(preflight.headers()["access-control-allow-origin"]).toBe(
    "http://127.0.0.1:5178",
  );
  const denied = await page.request.fetch(`${api}/api/v1/demo/ask`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://not-allowed.example",
      "Access-Control-Request-Method": "POST",
    },
  });
  expect(denied.status()).toBe(400);
  await page.getByLabel("رسالتك للمساعد").fill("هاي");
  let pending = page.waitForResponse(`${api}/api/v1/demo/ask`);
  await page.getByRole("button", { name: "إرسال", exact: true }).click();
  const greeting = await pending;
  expect(greeting.status()).toBe(200);
  expect((await greeting.json()).status).toBe("conversational");
  await expect(page.locator(".demo-message.assistant")).toContainText(
    "أهلًا بك",
  );
  await page.getByLabel("رسالتك للمساعد").fill("ما هي سياسة الإجازات؟");
  pending = page.waitForResponse(`${api}/api/v1/demo/ask`);
  await page.getByRole("button", { name: "إرسال", exact: true }).click();
  const factual = await pending;
  expect(factual.status()).toBe(503);
  expect((await factual.json()).error.code).toBe("AI_NOT_CONFIGURED");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".demo-message.assistant")).toHaveCount(1);
  const documents = await (
    await page.request.get(`${api}/api/v1/demo/documents`)
  ).json();
  expect(documents.documents).toHaveLength(4);
  const policy = documents.documents.find(
    (doc: { id: string }) => doc.id === "leave-policy",
  );
  const original = await page.request.get(
    `${api}/api/v1/demo/documents/leave-policy`,
  );
  expect(original.headers()["content-type"]).toContain("text/plain");
  expect(await original.text()).toContain(policy.sections[0].content);
  expect((await page.request.get(`${api}/api/v1/documents`)).status()).toBe(
    404,
  );
  await page.goto("/documents/leave");
  await expect(
    page.getByRole("heading", { name: "إجراءات الإجازة", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("رفع مستند", { exact: true })).toHaveCount(0);
});

test("source-link UI fixture opens the actual packaged FastAPI document on the configured origin", async ({
  page,
}) => {
  const api = "http://127.0.0.1:8018";
  const catalog = await (
    await page.request.get(`${api}/api/v1/demo/documents`)
  ).json();
  const document = catalog.documents.find(
    (item: { id: string }) => item.id === "leave-policy",
  );
  const quote = document.sections[0].content;
  // Presentation contract only: never a claim that Llama generated this fixture.
  await page.route(`${api}/api/v1/demo/ask`, (route) =>
    route.fulfill({
      headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:5178" },
      json: {
        status: "answered",
        answer: "اختبار عرض المصدر فقط",
        generated_by: "Cloudflare Workers AI / Llama",
        model: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
        sources: [
          {
            title: document.title,
            section: document.sections[0].title,
            quote,
            url: "/api/demo/documents/leave-policy",
          },
        ],
      },
    }),
  );
  await page.goto("/assistant");
  await page.getByLabel("رسالتك للمساعد").fill("ما هي سياسة الإجازات؟");
  await page.getByRole("button", { name: "إرسال", exact: true }).click();
  await page.locator(".demo-message.assistant summary").click();
  await expect(page.locator(".demo-message.assistant blockquote")).toHaveText(
    quote,
  );
  const link = page.getByRole("link", {
    name: "افتح المستند الأصلي",
    exact: true,
  });
  await expect(link).toHaveAttribute(
    "href",
    `${api}/api/v1/demo/documents/leave-policy`,
  );
  const popup = page.waitForEvent("popup");
  await link.click();
  const original = await popup;
  await original.waitForLoadState();
  expect(original.url()).toBe(`${api}/api/v1/demo/documents/leave-policy`);
  await expect(original.locator("body")).toContainText(quote);
});
