import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { knowledge } from "../src/demo/knowledge";

test("knowledge journey reads actual documents and hands a draft to the existing chat", async ({
  page,
}, info) => {
  let calls = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/demo/ask", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "من أول سؤال، إلى خطوتك التالية." }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("masar-home.png"),
    fullPage: true,
    animations: "disabled",
  });
  const tabs = page.getByRole("tablist", { name: "استكشف رحلة المعرفة" });
  await tabs.getByRole("tab", { name: /سؤالك/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.getByRole("tab", { name: /المعرفة/ })).toBeFocused();
  const doc = knowledge.find((item) => item.id === "leave")!;
  await page.getByRole("button", { name: doc.title, exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeFocused();
  await expect(page.getByRole("tabpanel").getByRole("blockquote")).toHaveText(
    doc.steps[0],
  );
  await page.getByRole("link", { name: "اقرأ المستند كاملًا" }).click();
  await expect(page).toHaveURL(/\/documents\/leave$/);
  await expect(
    page.getByText(doc.steps[0], { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/");
  const question = "وش المطلوب مني بعد المباشرة؟";
  await page.getByLabel("ما الذي تحتاج معرفته اليوم؟").fill(question);
  await page
    .getByRole("button", { name: "متابعة السؤال في اسأل مسار" })
    .click();
  await expect(page.getByLabel("رسالتك للمساعد")).toHaveValue(question);
  expect(calls).toBe(0); // No automatic inference or simulated answer.
  await page.screenshot({
    path: info.outputPath("masar-assistant.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("reduced motion keeps the journey readable and functional", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page
      .locator(".gateway-route-light")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("tab", { name: /خطوتك/ }).click();
  await page
    .getByRole("link", { name: "افتح دليل البداية", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);
});
