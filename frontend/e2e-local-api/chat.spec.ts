import { expect, test } from "@playwright/test";

test("real local Vite proxy reaches FastAPI; greetings work and missing AI never falls back", async ({
  page,
}) => {
  const documents = await (
    await page.request.get("/api/demo/documents")
  ).json();
  const policy = documents.documents.find(
    (doc: { id: string }) => doc.id === "leave-policy",
  );
  const original = await page.request.get("/api/demo/documents/leave-policy");
  expect(original.status()).toBe(200);
  expect(original.headers()["content-type"]).toContain("text/plain");
  expect(await original.text()).toContain(policy.sections[0].content);
  await page.goto("/assistant");
  await page.getByLabel("رسالتك للمساعد").fill("هاي");
  let pending = page.waitForResponse("**/api/demo/ask");
  await page.getByRole("button", { name: /إرسال/ }).click();
  const greeting = await pending;
  expect(greeting.status()).toBe(200);
  expect((await greeting.json()).status).toBe("conversational");
  await expect(page.locator(".demo-message.assistant")).toContainText(
    "أهلًا بك",
  );
  await page.getByLabel("رسالتك للمساعد").fill("ما هي سياسة الإجازات؟");
  pending = page.waitForResponse("**/api/demo/ask");
  await page.getByRole("button", { name: /إرسال/ }).click();
  const factual = await pending;
  expect(factual.status()).toBe(503);
  expect((await factual.json()).error.code).toBe("AI_NOT_CONFIGURED");
  await expect(page.getByRole("alert")).toContainText("Llama");
  await expect(page.locator(".demo-message.assistant")).toHaveCount(1);
});
