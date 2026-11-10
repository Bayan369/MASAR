import { expect, test, type Route } from "@playwright/test";

const reply = {
  status: "conversational",
  answer: "رد اختبار التركيز فقط",
  sources: [],
};

test("repeated button and Enter sends restore focus without remounting the textarea", async ({
  page,
}) => {
  const questions: string[] = [];
  await page.route("**/api/demo/ask", async (route) => {
    questions.push(route.request().postDataJSON().question);
    await route.fulfill({ json: reply });
  });
  await page.goto("/assistant");
  const input = page.getByLabel("رسالتك للمساعد", { exact: true });
  const original = await input.elementHandle();
  for (let i = 0; i < 6; i++) {
    const text = `رسالة متتالية ${i + 1}`;
    if (i === 0) await input.fill(text);
    else await page.keyboard.type(text);
    await expect(input).toHaveValue(text);
    if (i < 3)
      await page.getByRole("button", { name: "إرسال", exact: true }).click();
    else await page.keyboard.press("Enter");
    await expect(page.locator(".demo-message.assistant")).toHaveCount(i + 1);
    await expect(input).toBeEnabled();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    expect(await original!.evaluate((element) => element.isConnected)).toBe(
      true,
    );
  }
  expect(questions).toHaveLength(6);
});

test("loading blocks duplicate submits and failure restores focus for a keyboard retry", async ({
  page,
}) => {
  const pending: Route[] = [];
  await page.route("**/api/demo/ask", (route) => {
    pending.push(route);
  });
  await page.goto("/assistant");
  const input = page.getByLabel("رسالتك للمساعد", { exact: true });
  await input.fill("رسالة قد يفشل إرسالها");
  await input.press("Enter");
  await expect.poll(() => pending.length).toBe(1);
  await expect(input).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "إرسال", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toBeVisible();
  await page
    .locator(".demo-composer")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.keyboard.press("Enter");
  expect(pending).toHaveLength(1);
  await pending[0].fulfill({
    status: 502,
    json: { error: { code: "AI_PROVIDER_ERROR" } },
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await page.keyboard.type("إعادة المحاولة من لوحة المفاتيح");
  await page.keyboard.press("Enter");
  await expect.poll(() => pending.length).toBe(2);
  await pending[1].fulfill({ json: reply });
  await expect(input).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".demo-message.assistant")).toHaveCount(1);
  await page.keyboard.type("مسودة الرسالة التالية");
  await expect(input).toHaveValue("مسودة الرسالة التالية");
  await input.press("ArrowLeft");
  const draft = await input.evaluate((element: HTMLTextAreaElement) => ({
    value: element.value,
    start: element.selectionStart,
    end: element.selectionEnd,
  }));
  await page.keyboard.type("!");
  await expect(input).toHaveValue(
    draft.value.slice(0, draft.start) + "!" + draft.value.slice(draft.end),
  );
  await input.press("Tab");
  await expect(
    page.getByRole("button", { name: "إرسال", exact: true }),
  ).toBeFocused();
});

test("a response completing on another page does not focus the hidden composer", async ({
  page,
}) => {
  let pending: Route | undefined;
  await page.route("**/api/demo/ask", (route) => {
    pending = route;
  });
  await page.goto("/assistant");
  await page.getByLabel("رسالتك للمساعد").fill("رسالة قبل مغادرة المحادثة");
  await page.getByRole("button", { name: "إرسال", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  const menu = page.locator(".masar-menu-button");
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "قاعدة المعرفة", exact: true })
    .click();
  const heading = page.getByRole("heading", {
    name: "قاعدة المعرفة",
    level: 1,
  });
  await expect(heading).toBeFocused();
  await pending!.fulfill({ json: reply });
  await expect(page.locator(".demo-message.assistant")).toHaveCount(1);
  await expect(heading).toBeFocused();
});
