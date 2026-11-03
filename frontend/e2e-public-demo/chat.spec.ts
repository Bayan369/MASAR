import { expect, test } from "@playwright/test";

test("live mode uses API sources and shows errors without offline fallback (mocked network)", async ({
  page,
}) => {
  let fail = false;
  let calls = 0;
  await page.route("**/api/demo/ask", async (route) => {
    calls++;
    expect(route.request().postDataJSON().question).toContain("إجازة");
    await route.fulfill({
      status: fail ? 502 : 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(
        fail
          ? {
              error: {
                message: "تعذّر الاتصال بخدمة Llama؛ لم تُستخدم إجابة بديلة.",
              },
            }
          : {
              status: "answered",
              answer: "إجابة اختبار من API فقط",
              sources: [{ title: "مصدر API للاختبار", quote: "اقتباس اختبار" }],
              generated_by: "Cloudflare Workers AI / Llama",
              model: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
            },
      ),
    });
  });
  await page.goto("/assistant");
  await page.getByLabel("رسالتك للمساعد").fill("كيف أطلب إجازة؟");
  const pending = page.waitForResponse("**/api/demo/ask");
  await page.getByRole("button", { name: /إرسال/ }).click();
  const response = await pending;
  expect(response.headers()["content-type"]).toContain("charset=utf-8");
  const bytes = await response.body();
  expect(bytes.toString("utf8")).toContain("إجابة اختبار من API فقط");
  expect((await response.json()).sources[0].quote).toBe("اقتباس اختبار");
  await expect(
    page.getByText("إجابة اختبار من API فقط", { exact: true }),
  ).toBeVisible();
  await page.getByText("المصدر: مصدر API للاختبار").click();
  await expect(page.getByText("اقتباس اختبار", { exact: true })).toBeVisible();
  await expect(page.locator(".demo-message.assistant")).not.toContainText(
    /[ØÙ�]/,
  );
  fail = true;
  await page.getByLabel("رسالتك للمساعد").fill("كيف أطلب إجازة؟");
  await page.getByRole("button", { name: /إرسال/ }).click();
  await expect(page.getByRole("alert")).toContainText("Llama");
  await expect(page.locator(".demo-message.assistant")).toHaveCount(1);
  expect(calls).toBe(2);
});
