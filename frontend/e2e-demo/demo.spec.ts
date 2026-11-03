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
  expect(await log.evaluate((el) => getComputedStyle(el).overflowY)).toBe(
    "auto",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "اسأل مسار" }),
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
  await navigate(page, "اسأل مسار MASAR AI");
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
  await navigate(page, "اسأل مسار MASAR AI");
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

test("Saudi greeting, procedure, contextual contact and next step", async ({
  page,
}) => {
  const observed = observe(page);
  await page.goto("/assistant");
  const log = page.getByRole("log");
  await send(page, "هلا والله");
  await expect(log.locator(".assistant").last()).toContainText("أهلًا بك");
  await send(page, "ابي اجازة من الشركة");
  await expect(log.locator(".assistant").last()).toContainText("حدّد تواريخ");
  await send(page, "طيب مين اكلم؟");
  await expect(log.locator(".assistant").last()).toContainText(
    "hr@masar-demo.invalid",
  );
  await send(page, "طيب وش بعدها؟");
  await expect(log.locator(".assistant").last()).toContainText(
    "بعد موافقة المدير",
  );
  await assertClean(page);
  expect(observed.external).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test("assistant viewport, welcome suggestions and fixed composer", async ({
  page,
}, info) => {
  await page.goto("/assistant");
  const log = page.getByRole("log");
  const composer = page.locator(".demo-composer");
  const suggestions = page.locator(".platform-chat-suggestions");
  await expect(suggestions.getByRole("button")).toHaveCount(3);
  for (const button of await suggestions.getByRole("button").all()) {
    await expect(button).toBeInViewport();
  }
  const initial = await page.evaluate(() => {
    const welcome = document
      .querySelector(".demo-welcome > p")!
      .getBoundingClientRect();
    const suggestions = document
      .querySelector(".platform-chat-suggestions")!
      .getBoundingClientRect();
    const composer = document
      .querySelector(".demo-composer")!
      .getBoundingClientRect();
    return {
      order:
        welcome.bottom <= suggestions.top && suggestions.bottom <= composer.top,
      fits: document.documentElement.scrollHeight <= innerHeight + 1,
      horizontal: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  expect(initial).toEqual({ order: true, fits: true, horizontal: true });
  await page.screenshot({
    path: info.outputPath("welcome.png"),
    fullPage: true,
  });
  const composerBefore = (await composer.boundingBox())!;
  await send(page, "كيف أبدأ أول يوم؟");
  await expect(suggestions).toHaveCount(0);
  for (const question of [
    "طيب وبعدها؟",
    "وش تقصد؟",
    "كيف أطلب إجازة؟",
    "طيب وبعدها؟",
    "وش تقصد؟",
  ]) {
    await send(page, question);
  }
  await expect(log.locator(".demo-message").last()).toBeInViewport();
  const composerAfter = (await composer.boundingBox())!;
  expect(Math.abs(composerBefore.y - composerAfter.y)).toBeLessThan(2);
  expect(Math.abs(composerBefore.height - composerAfter.height)).toBeLessThan(
    2,
  );
  expect(await log.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight + 1 &&
        window.scrollY === 0,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("conversation.png"),
    fullPage: true,
  });
});

test("assistant uses the app canvas without an inner page at wide and short sizes", async ({
  page,
}, info) => {
  const sizes =
    info.project.name === "desktop"
      ? [
          { width: 1920, height: 1080 },
          { width: 1280, height: 540 },
        ]
      : info.project.name === "mobile"
        ? [{ width: 375, height: 667 }]
        : [{ width: 900, height: 700 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto("/assistant");
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const main = document.querySelector(".demo-main")!;
      const body = document.querySelector(".platform-body")!;
      const log = document.querySelector(".demo-messages")!;
      const composer = document.querySelector(".demo-composer")!;
      const mainRect = main.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const logRect = log.getBoundingClientRect();
      return {
        fullWidth:
          Math.abs(mainRect.width - bodyRect.width) < 1 &&
          Math.abs(mainRect.x - bodyRect.x) < 1,
        messagesFullWidth: Math.abs(logRect.width - mainRect.width) < 1,
        wrappers: [".platform-chat", ".platform-chat-content"].map(
          (selector) =>
            getComputedStyle(document.querySelector(selector)!).display,
        ),
        pageFits:
          document.documentElement.scrollHeight <= innerHeight + 1 &&
          document.documentElement.scrollWidth <= innerWidth,
        welcomeFits: log.scrollHeight <= log.clientHeight + 1,
        composerFits:
          composer.getBoundingClientRect().bottom <= innerHeight + 1,
      };
    });
    expect(geometry).toEqual({
      fullWidth: true,
      messagesFullWidth: true,
      wrappers: ["contents", "contents"],
      pageFits: true,
      welcomeFits: true,
      composerFits: true,
    });
    await page.screenshot({
      path: info.outputPath(`canvas-${size.width}.png`),
      fullPage: true,
    });
  }
});
