import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { departments } from "../src/demo/catalog";
import { knowledge } from "../src/demo/knowledge";
const retired =
  /تجريب|الديمو|نسخة\s*(?:عرض|العرض)|Mock Data|Demo Assistant|مساحة آمنة للاستكشاف|لا يستخدم Llama|السجل محلي|لا تدخل معلومات شخصية|دون تسجيل دخول|ليست معلومات شركتك|جهة عمل حقيقية|مثال تعليمي/;
async function openNavigation(page: Page) {
  const button = page.getByRole("button", { name: "فتح القائمة", exact: true });
  if (await button.isVisible()) await button.click();
}
async function navigate(page: Page, name: string) {
  await openNavigation(page);
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name })
    .click();
}
function observe(page: Page) {
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
  return { external, errors };
}
async function assertClean(page: Page) {
  expect(await page.locator("body").innerText()).not.toMatch(retired);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("textbox", { name: "البريد الإلكتروني" }),
  ).toHaveCount(0);
}
async function send(page: Page, text: string) {
  const input = page.getByLabel("رسالتك للمساعد", { exact: true });
  await input.fill(text);
  await page.getByRole("button", { name: "إرسال", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(input).toBeEnabled();
}

test("contextual chat, exact sources, cross-page context and independent history", async ({
  page,
}, info) => {
  const observed = observe(page);
  await page.goto("/assistant");
  const log = page.getByRole("log");
  await expect(
    page.getByRole("heading", { level: 1, name: "مسار الذكي" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await send(page, "كيف أبدأ أول يوم؟");
  await expect(log.getByText("إجابة موثقة", { exact: true })).toHaveCount(1);
  await send(page, "طيب وبعدها؟");
  await expect(
    log.getByText("بعد ذلك، تواصل", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "تعرف على قسم تقنية المعلومات (IT)" })
    .last()
    .click();
  await expect(page).toHaveURL(/\/departments\/it$/);
  await navigate(page, "مسار الذكي MASAR AI");
  await send(page, "وش تقصد؟");
  await expect(
    log.getByText("المقصود بالخطوة السابقة", { exact: false }),
  ).toBeVisible();
  await log.locator("summary").last().click();
  await expect(log.locator("blockquote").last()).toHaveText(
    knowledge.find((d) => d.id === "onboarding")!.steps[1],
  );
  await log.getByRole("link", { name: "افتح المستند الأصلي" }).last().click();
  await expect(page).toHaveURL(/\/documents\/onboarding$/);
  await navigate(page, "مسار الذكي MASAR AI");
  await send(page, "كم راتبي؟");
  await expect(
    log.getByText("معلومة غير متوفرة", { exact: true }),
  ).toBeVisible();
  await expect(
    log.getByRole("link", {
      name: "اقتراح غير مؤكد · قسم الموارد البشرية (HR)",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "محادثة جديدة", exact: true }).click();
  await send(page, "طيب وبعدها؟");
  await expect(
    log.getByText("عن أي إجراء تقصد؟", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "كيف أبدأ أول يوم؟", exact: true })
    .click();
  await expect(
    log.getByText("معلومة غير متوفرة", { exact: true }),
  ).toBeVisible();
  await assertClean(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/masar-redesign-chat-${info.project.name}.png`,
    fullPage: true,
  });
  expect(observed.external).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test("every platform and legacy route, source link, clean copy and accessibility", async ({
  page,
}, info) => {
  const observed = observe(page);
  const routes = [
    "/",
    "/departments",
    "/onboarding",
    "/policies",
    "/documents",
    "/assistant",
    ...departments.map((d) => `/departments/${d.id}`),
    ...["leave", "it", "vpn"].map((id) => `/policies/${id}`),
    ...knowledge.map((d) => `/documents/${d.id}`),
  ];
  const visualRoutes = [
    "/",
    "/departments",
    "/onboarding",
    "/policies",
    "/documents",
    "/departments/hr",
    "/documents/leave",
    "/policies/vpn",
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).not.toHaveText("الصفحة غير موجودة");
    await expect(
      page.getByText("هذه الصفحة غير موجودة", { exact: true }),
    ).toHaveCount(0);
    await assertClean(page);
    if (visualRoutes.includes(route)) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `/tmp/masar-redesign-${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  }
  for (const route of routes) {
    const old = route === "/" ? "/demo" : `/demo${route}`;
    await page.goto(old);
    await expect(page).toHaveURL(`http://127.0.0.1:5175${route}`);
    await expect(page.locator("h1")).not.toHaveText("الصفحة غير موجودة");
  }
  for (const route of ["/login", "/reset-password"]) {
    await page.goto(route);
    await expect(page).toHaveURL("http://127.0.0.1:5175/");
    await expect(
      page.getByRole("heading", { level: 1, name: "الرئيسية" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "تسجيل الدخول" }),
    ).toHaveCount(0);
  }
  await page.goto("/departments/hr");
  await page
    .getByRole("link", {
      name: "مرجع المعلومات بطاقة قسم الموارد البشرية (HR) قراءة المصدر",
    })
    .click();
  await expect(page).toHaveURL(/\/documents\/department-hr$/);
  await expect(page.locator(".platform-reading")).toContainText(
    "hr@masar-demo.invalid",
  );
  await page
    .getByRole("link", { name: "افتح صفحة قسم الموارد البشرية" })
    .click();
  await expect(page).toHaveURL(/\/departments\/hr$/);
  for (const route of [
    "/unknown",
    "/departments/missing",
    "/documents/missing",
    "/policies/missing",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "هذه الصفحة غير موجودة" }),
    ).toBeVisible();
    await assertClean(page);
  }
  expect(observed.external).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test("department and document search, categories, empty states and original content", async ({
  page,
}) => {
  const observed = observe(page);
  await page.goto("/departments");
  const departmentSearch = page.getByRole("textbox", {
    name: "البحث في الأقسام",
  });
  await departmentSearch.fill("IT");
  await expect(page.locator(".platform-department-card")).toHaveCount(1);
  await expect(page.locator(".platform-department-card")).toContainText(
    "تقنية المعلومات",
  );
  await departmentSearch.fill("غيرموجود");
  await expect(
    page.getByRole("heading", { name: "لم نجد نتائج مطابقة" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "مسح البحث", exact: true })
    .last()
    .click();
  await expect(page.locator(".platform-department-card")).toHaveCount(
    departments.length,
  );
  await navigate(page, "المستندات والملفات Documents");
  await expect(page.locator("a.platform-document")).toHaveCount(
    knowledge.length,
  );
  await page.getByRole("button", { name: "الأقسام", exact: true }).click();
  await expect(page.locator("a.platform-document")).toHaveCount(
    departments.length,
  );
  await page.getByRole("button", { name: "الشركة", exact: true }).click();
  await expect(page.locator("a.platform-document")).toHaveCount(1);
  await page.getByRole("button", { name: "الكل", exact: true }).click();
  const search = page.getByRole("textbox", { name: "البحث في المستندات" });
  await search.fill("VPN");
  await expect(page.locator("a.platform-document")).not.toHaveCount(0);
  await search.fill("غيرموجود");
  await expect(
    page.getByRole("heading", { name: "لم نجد نتائج مطابقة" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "مسح البحث", exact: true })
    .last()
    .click();
  await expect(page.locator("a.platform-document")).toHaveCount(
    knowledge.length,
  );
  await page.goto("/documents/leave");
  for (const step of knowledge.find((d) => d.id === "leave")!.steps) {
    await expect(page.locator(".platform-reading")).toContainText(step);
  }
  await page.getByRole("link", { name: "المقطع 2", exact: false }).click();
  await expect(page).toHaveURL(/#part-2$/);
  await assertClean(page);
  expect(observed.external).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test("keyboard navigation, responsive menu, suggested question and multiline input", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "الرئيسية" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "انتقل إلى المحتوى" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("button", { name: "فتح القائمة", exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(
      page.getByRole("navigation", { name: "التنقل الرئيسي" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(
      page.getByRole("navigation", { name: "التنقل الرئيسي" }),
    ).toBeHidden();
  }
  await navigate(page, "دليل الأقسام Departments");
  await expect(page.locator("h1")).toBeFocused();
  await page.getByRole("link", { name: /IT.*تقنية المعلومات/ }).click();
  await page.getByRole("link", { name: "اسأل مسار عن القسم" }).click();
  await expect(page.getByLabel("رسالتك للمساعد", { exact: true })).toHaveValue(
    "ما مهام تقنية المعلومات؟",
  );
  const input = page.getByLabel("رسالتك للمساعد", { exact: true });
  await input.fill("How do I connect to VPN?");
  await input.press("Enter");
  await expect(input).toBeEnabled();
  await expect(
    page.getByRole("log").getByText("إجابة موثقة", { exact: true }),
  ).toBeVisible();
  await input.fill("what next?");
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("what next?\n");
  await input.press("Enter");
  await expect(input).toBeEnabled();
  await expect(
    page.getByRole("log").getByText("بعد الموافقة", { exact: false }).first(),
  ).toBeVisible();
  await assertClean(page);
});
