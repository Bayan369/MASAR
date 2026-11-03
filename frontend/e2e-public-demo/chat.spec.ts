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

test("greeting, backend policy source and affirmative share the same API conversation (contract fixture)", async ({
  page,
}) => {
  const quote = "مصدر سياسة الإجازات من Backend للاختبار";
  let step = 0;
  await page.route("**/api/demo/ask", async (route) => {
    const body = route.request().postDataJSON();
    if (step === 0) {
      expect(body.question).toBe("هاي");
      await route.fulfill({
        json: {
          status: "conversational",
          answer: "أهلًا بك، كيف أساعدك؟",
          sources: [],
        },
      });
    } else {
      if (step === 1) expect(body.question).toBe("ما هي سياسة الإجازات؟");
      else {
        expect(body.question).toBe("إيه");
        expect(body.history.at(-1).content).toContain(
          "هل تريد معرفة الخطوة التالية؟",
        );
        expect(
          body.history.some(
            (turn: { content: string }) =>
              turn.content === "ما هي سياسة الإجازات؟",
          ),
        ).toBe(true);
      }
      await route.fulfill({
        json: {
          status: "answered",
          answer:
            step === 1
              ? "إجابة السياسة من API. هل تريد معرفة الخطوة التالية؟"
              : "متابعة موثقة من API",
          sources: [
            {
              id: "S1:E1",
              document_id: "leave-policy",
              title: "سياسة الإجازات",
              quote,
              section: "الإجازة السنوية",
              excerpt: quote,
            },
          ],
          generated_by: "Cloudflare Workers AI / Llama",
          model: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
        },
      });
    }
    step++;
  });
  await page.goto("/assistant");
  for (const [question, answer] of [
    ["هاي", "أهلًا بك، كيف أساعدك؟"],
    [
      "ما هي سياسة الإجازات؟",
      "إجابة السياسة من API. هل تريد معرفة الخطوة التالية؟",
    ],
    ["إيه", "متابعة موثقة من API"],
  ]) {
    await page.getByLabel("رسالتك للمساعد").fill(question);
    await page.getByRole("button", { name: /إرسال/ }).click();
    await expect(page.getByText(answer, { exact: true })).toBeVisible();
  }
  await page.getByText("المصدر: سياسة الإجازات").last().click();
  await expect(page.getByText(quote, { exact: true }).last()).toBeVisible();
  expect(step).toBe(3);
});
