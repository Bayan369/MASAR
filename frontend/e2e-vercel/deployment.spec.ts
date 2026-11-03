import { expect, test } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

test("direct routes and reloads work with production headers and local assets", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push("console error");
  });
  page.on("pageerror", () => failures.push("page error"));
  page.on("requestfailed", () => failures.push("failed request"));
  await page.addInitScript(() => {
    const state = window as typeof window & { policyFailures: string[] };
    state.policyFailures = [];
    window.addEventListener("securitypolicyviolation", (event) =>
      state.policyFailures.push(event.effectiveDirective),
    );
  });
  for (const route of [
    "/",
    "/assistant",
    "/departments/hr",
    "/onboarding",
    "/policies/vpn",
    "/documents/leave",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const headers = response!.headers();
    expect(headers["content-type"]).toContain("text/html");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["content-security-policy"]).toContain("connect-src 'self'");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["content-security-policy"]).not.toMatch(
      /localhost|127\.0\.0\.1|unsafe-inline|unsafe-eval/,
    );
    await expect(page.locator("h1")).toBeVisible();
    await page.reload();
    await expect(page.locator("h1")).not.toContainText("الصفحة غير موجودة");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() =>
        document.fonts.check('400 16px "IBM Plex Sans Arabic"', "مسار"),
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".gateway-mark")
        .evaluateAll((elements) =>
          elements.every(
            (el) =>
              el instanceof HTMLImageElement &&
              el.complete &&
              el.naturalWidth > 0,
          ),
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { policyFailures: string[] })
            .policyFailures,
      ),
    ).toEqual([]);
  }
  const output = resolve("dist");
  const files = await readdir(resolve(output, "assets"));
  for (const file of files.filter((name) => /\.(js|css|woff2?)$/.test(name))) {
    const response = await page.request.get("/assets/" + file);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).not.toContain("text/html");
    if (file.endsWith(".js")) {
      const code = await readFile(resolve(output, "assets", file), "utf8");
      expect(code).not.toMatch(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/);
    }
  }
  expect(failures).toEqual([]);
});
