import { expect, test } from "@playwright/test";
// Opt-in REAL Auth + RLS + existing approved document + one question. No stubs.
test("real authenticated browser to tenant retrieval to Llama evidence", async ({
  page,
}) => {
  const email = process.env.MASAR_LIVE_EMAIL,
    password = process.env.MASAR_LIVE_PASSWORD,
    question = process.env.MASAR_LIVE_QUESTION;
  if (!email || !password || !question)
    throw new Error(
      "Configure MASAR_LIVE_EMAIL, MASAR_LIVE_PASSWORD and MASAR_LIVE_QUESTION securely; no values are printed.",
    );
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto("/assistant");
  await page.getByLabel("سؤالك للمساعد الذكي").fill(question);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/assistant/ask") &&
      r.request().method() === "POST",
    { timeout: 180000 },
  );
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  const r = await response;
  expect(r.status(), "Stop on any failure; do not retry inference").toBe(200);
  const data = await r.json();
  expect(data.demo).toBe(false);
  expect(data.status).toBe("answered");
  expect(data.generated_by).toBe("Cloudflare Workers AI / Llama");
  expect(data.sources.length).toBeGreaterThan(0);
  for (const source of data.sources) {
    expect(source.chunk_id).toBeTruthy();
    expect(source.excerpt.includes(source.quote)).toBe(true);
  }
  expect(data.conversation_id).toBeTruthy();
  await expect(page.getByLabel("إجابة مسار")).toBeVisible();
  await page.locator(".answer-sources a").first().click();
  await expect(page.locator(".demo-document-reader")).toBeVisible();
});
