import { expect, test } from "@playwright/test";
// Real local FastAPI, no routing mocks. The normal test server explicitly blocks live AI.
test("real backend refuses an unknown question and fails closed for unconfigured AI", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page.getByLabel("سؤالك للمساعد الذكي").fill("quantum banana spaceship");
  const unknownResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/assistant/ask"),
  );
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  const unknown = await unknownResponse;
  expect(unknown.status()).toBe(200);
  const data = await unknown.json();
  expect(data.status).toBe("not_found");
  expect(data.generated_by).toBeNull();
  expect(data.sources).toEqual([]);
  await expect(page.getByLabel("إجابة مسار")).toContainText(
    "لا تتوفر معلومة موثقة",
  );
  await page
    .getByLabel("سؤالك للمساعد الذكي")
    .fill("How many annual leave days?");
  const configuredResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/v1/assistant/ask"),
  );
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  const response = await configuredResponse;
  expect(response.status()).toBe(503);
  expect([
    "AI_NOT_CONFIGURED",
    "FREE_PLAN_NOT_CONFIRMED",
    "AI_CONFIGURATION_INVALID",
  ]).toContain((await response.json()).error.code);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("إجابة مسار")).toHaveCount(0);
});
