import { expect, test } from "@playwright/test";
test("RTL dashboard, real navigation, empty states and mixed-language question", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("مسارك");
  await expect(page.getByText("كل رحلة تبدأ بسؤال")).toBeVisible();
  await page
    .getByRole("button", {
      name: "كيف أطلب صلاحية الشبكة الافتراضية الخاصة (VPN)؟",
    })
    .click();
  await expect(page.getByLabel("سؤالك للمساعد الذكي")).toHaveValue(/VPN/);
  await page.getByRole("button", { name: "اسأل مسار" }).click();
  await expect(page).toHaveURL(/assistant/);
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  await expect(page.getByRole("status")).toContainText("المساعد غير متصل");
  await page.goto("/departments");
  await page.getByLabel("البحث في الأقسام").fill("IT");
  await expect(page.locator(".department-card")).toHaveCount(1);
  await page.locator(".department-card").click();
  await expect(page.locator(".department-detail")).toContainText(
    "لم تُضف بيانات",
  );
  await page.goto("/knowledge");
  await page.getByRole("button", { name: "السياسات", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "السياسات", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("مصادر شركتك، قريبًا هنا")).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("تقليل الحركة").check();
  await page.getByRole("button", { name: "حفظ التفضيلات" }).click();
  await expect(page.getByRole("status")).toContainText("حُفظت");
  await page.reload();
  await expect(page.getByLabel("تقليل الحركة")).toBeChecked();
  expect(errors).toEqual([]);
});
test("login validates, toggles password, and never authenticates", async ({
  page,
}) => {
  let body: string | null | undefined;
  await page.route("**/api/v1/auth/login", async (route) => {
    body = route.request().postData();
    await route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "AUTH_NOT_CONFIGURED" } }),
    });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.getByText("أدخل بريدًا إلكترونيًا صالحًا.")).toBeVisible();
  await page.getByLabel("البريد الإلكتروني للعمل").fill("test@example.com");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("test-only");
  await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("لم يتم إنشاء جلسة");
  expect(body).toBeNull();
  await expect(page).toHaveURL(/login/);
});
test("all screens fit viewport and mobile navigation operates", async ({
  page,
}, info) => {
  for (const path of [
    "/",
    "/assistant",
    "/departments",
    "/knowledge",
    "/history",
    "/settings",
    "/login",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  if (info.project.name === "mobile") {
    await page.goto("/");
    await page.getByRole("button", { name: "فتح القائمة" }).click();
    await page.getByRole("link", { name: /الأقسام.*Departments/ }).click();
    await expect(page).toHaveURL(/departments/);
    await expect(
      page.getByRole("button", { name: "فتح القائمة" }),
    ).toHaveAttribute("aria-expanded", "false");
  }
});

test("Arabic screens meet automated accessibility checks", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of [
    "/",
    "/assistant",
    "/departments",
    "/knowledge",
    "/history",
    "/settings",
    "/login",
  ]) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      `${route}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
});
