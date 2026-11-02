import { expect, test } from "@playwright/test";
// NO routing stubs or synthetic AI replies: exactly one real question.
test("real browser → FastAPI → Cloudflare Llama → cited Arabic answer", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page
    .getByLabel("سؤالك للمساعد الذكي")
    .fill("كم يوم الإجازة السنوية في الشركة التجريبية؟");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/assistant/ask") &&
      r.request().method() === "POST",
    { timeout: 45000 },
  );
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  const r = await response;
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.status).toBe("answered");
  expect(data.generated_by).toBe("Cloudflare Workers AI / Llama");
  expect(
    data.sources.some(
      (s: { document_id: string }) => s.document_id === "leave-policy",
    ),
  ).toBe(true);
  await expect(page.getByLabel("إجابة مسار")).toContainText("21");
  await expect(page.locator(".answer-sources")).toContainText("Leave Policy");
  await page.screenshot({ path: "/tmp/masar-mvp-live.png", fullPage: true });
  await page.locator(".answer-sources a").first().click();
  await expect(page.locator(".demo-document-reader")).toContainText("21");
});
