import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("offline multi-turn conversation, sources, unknown answers and session history", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5175") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "المساعد التجريبي (Demo Assistant)" }),
  ).toBeVisible();
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByText("لا يستخدم Llama", { exact: false }),
  ).toBeVisible();
  const input = page.getByLabel("رسالتك للمساعد التجريبي");
  const log = page.getByRole("log");
  async function send(text: string) {
    await input.fill(text);
    await page.getByRole("button", { name: "إرسال", exact: true }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(input).toBeEnabled();
  }
  await send("كيف أبدأ أول يوم؟");
  await expect(log.getByText("إجابة موثقة من بيانات تجريبية")).toHaveCount(1);
  await send("طيب وبعدها؟");
  await expect(
    log.getByText("بعد ذلك، تواصل", { exact: false }).first(),
  ).toBeVisible();
  await send("وش تقصد؟");
  await expect(
    log.getByText("المقصود بالخطوة السابقة", { exact: false }),
  ).toBeVisible();
  await log.locator("summary").last().click();
  await expect(log.locator("blockquote").last()).toContainText("جهاز العمل");
  await send("كم راتبي؟");
  await expect(
    log.getByText("معلومة غير متوفرة", { exact: true }),
  ).toBeVisible();
  await expect(
    log.getByText("لا تتوفر هذه المعلومة", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "محادثة جديدة", exact: true }).click();
  await send("طيب وبعدها؟");
  await expect(
    log.getByText("عن أي إجراء تقصد؟", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "كيف أبدأ أول يوم؟", exact: true })
    .click();
  await expect(
    log.getByText("معلومة غير متوفرة", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(external).toEqual([]);
});
