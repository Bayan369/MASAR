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
    page.getByRole("heading", { name: "الرئيسية (Home)" }),
  ).toBeVisible();
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByText("لا يستخدم Llama", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "مسار الذكي MASAR AI" })
    .click();
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
  await page
    .getByRole("link", { name: "تعرف على قسم تقنية المعلومات (IT) ←" })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "تقنية المعلومات (IT)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "مسار الذكي MASAR AI" })
    .click();
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

test("all employee platform routes load directly, sources resolve and navigation stays offline", async ({
  page,
}, testInfo) => {
  const { departments } = await import("../src/demo/catalog");
  const { knowledge } = await import("../src/demo/knowledge");
  const routes = [
    "/demo",
    "/demo/departments",
    "/demo/onboarding",
    "/demo/policies",
    "/demo/documents",
    "/demo/assistant",
    ...departments.map((d) => `/demo/departments/${d.id}`),
    ...["leave", "it", "vpn"].map((id) => `/demo/policies/${id}`),
    ...knowledge.map((d) => `/demo/documents/${d.id}`),
  ];
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5175") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("navigation", { name: "التنقل الرئيسي" }),
    ).toBeVisible();
    await expect(page.locator("h1")).not.toHaveText("الصفحة غير موجودة");
    await expect(
      page.getByText("هذه الصفحة غير موجودة", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (
      [
        "/demo",
        "/demo/departments",
        "/demo/onboarding",
        "/demo/policies",
        "/demo/documents",
        "/demo/departments/hr",
        "/demo/documents/leave",
      ].includes(route)
    ) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    if (route === "/demo")
      await page.screenshot({
        path: `/tmp/masar-platform-${testInfo.project.name}.png`,
        fullPage: true,
      });
  }
  await page.goto("/demo/departments/hr");
  await page
    .getByRole("link", {
      name: "المصدر التجريبي: بطاقة قسم الموارد البشرية (HR) التجريبية",
    })
    .click();
  await expect(page).toHaveURL(/\/demo\/documents\/department-hr$/);
  await expect(
    page
      .locator(".platform-reading")
      .getByText("جهة التواصل التجريبية:", { exact: false }),
  ).toContainText("hr@masar-demo.invalid");
  await page
    .getByRole("link", { name: "افتح صفحة قسم الموارد البشرية ←" })
    .click();
  await expect(page).toHaveURL(/\/demo\/departments\/hr$/);
  for (const route of [
    "/demo/unknown",
    "/demo/departments/missing",
    "/demo/documents/missing",
    "/demo/policies/missing",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "هذه الصفحة غير موجودة" }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
