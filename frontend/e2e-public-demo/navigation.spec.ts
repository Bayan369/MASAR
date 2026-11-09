import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Arabic navbar, active route, responsive disclosure and visual workspace", async ({
  page,
}, info) => {
  await page.goto("/");
  const menu = page.locator(".masar-menu-button");
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  if (await menu.isVisible()) await menu.click();
  await expect(nav.getByRole("link")).toHaveCount(
    info.project.name === "mobile" ? 6 : 5,
  );
  for (const name of [
    "الرئيسية",
    "دليل الأقسام",
    "قاعدة المعرفة",
    "المهام",
    "اسأل مسار",
  ]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(
    nav.getByRole("link", { name: "الرئيسية", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await nav.innerText()).not.toMatch(
    /Home|Departments|Knowledge Base|MASAR AI|Getting Started|Documents/,
  );
  await nav.getByRole("link", { name: "قاعدة المعرفة", exact: true }).click();
  await expect(page).toHaveURL(/\/documents$/);
  if (await menu.isVisible()) {
    await expect(nav).toBeHidden();
    await menu.click();
  }
  await expect(
    nav.getByRole("link", { name: "قاعدة المعرفة", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (
    await page
      .getByRole("button", { name: "إغلاق القائمة", exact: true })
      .isVisible()
  )
    await page.keyboard.press("Escape");
  for (const [path, file] of [
    ["/", "home"],
    ["/departments", "departments"],
    ["/documents", "knowledge"],
    ["/assistant", "assistant"],
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`studio-${file}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});
