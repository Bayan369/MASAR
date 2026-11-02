import { expect, test } from "@playwright/test";
import { workspace, docId, convId, session } from "./fixtures";
test("private routes, invalid credentials and real SDK login contract", async ({
  page,
}) => {
  await page.goto("/assistant");
  await expect(page).toHaveURL(/login/);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.getByText("أدخل بريدًا إلكترونيًا صالحًا.")).toBeVisible();
  await page
    .getByLabel("البريد الإلكتروني للعمل")
    .fill("browser@example.invalid");
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("browser-test-only");
  await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.route(
    "https://browser-contract.supabase.co/auth/v1/token**",
    (r) =>
      r.fulfill({
        status: 400,
        json: { error_code: "invalid_credentials", msg: "invalid" },
      }),
  );
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("تعذّر تسجيل الدخول");
  await page.route("**/api/v1/me", (r) =>
    r.fulfill({
      json: {
        profile: {
          id: session.user.id,
          role: "new_employee",
          display_name: "اختبار",
        },
        company: { name: "اختبار" },
      },
    }),
  );
  await page.route(
    "https://browser-contract.supabase.co/auth/v1/token**",
    (r) => r.fulfill({ json: session }),
  );
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).toHaveURL(/assistant/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "المساعد الذكي",
  );
});
test("all RTL screens fit viewport and navigation works", async ({
  page,
}, info) => {
  await workspace(page);
  for (const path of [
    "/",
    "/assistant",
    "/departments",
    "/knowledge",
    "/history",
    "/settings",
    "/reset-password",
    "/login",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await expect(page.getByText("كل رحلة تبدأ بسؤال")).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "فتح القائمة" }).click();
    await page.getByRole("link", { name: /الأقسام.*Departments/ }).click();
    await expect(page).toHaveURL(/departments/);
    await expect(
      page.getByRole("button", { name: "فتح القائمة" }),
    ).toHaveAttribute("aria-expanded", "false");
  }
  await page.goto("/knowledge");
  await expect(page.getByText("لا توجد مستندات متاحة")).toBeVisible();
  await expect(page.getByRole("heading", { name: /رفع مستند/ })).toHaveCount(0);
});
test("assistant evidence, source navigation and safe provider failures", async ({
  page,
}) => {
  await workspace(page);
  await page.route("**/api/v1/documents", (r) =>
    r.fulfill({
      json: [
        {
          id: docId,
          title: "مصدر اختبار المتصفح",
          status: "published",
          original_name: "browser-test.txt",
        },
      ],
    }),
  );
  await page.route("**/api/v1/documents/*/chunks", (r) =>
    r.fulfill({
      json: [
        { id: "chunk", content: "مقطع اختبار واجهة فقط.", page_number: 1 },
      ],
    }),
  );
  let question = "";
  let requestId = "";
  await page.route("**/api/v1/assistant/ask", (r) => {
    const d = r.request().postDataJSON();
    question = d.question;
    requestId = d.request_id;
    return r.fulfill({
      json: {
        status: "answered",
        answer: "إجابة اختبار عقد الواجهة فقط.",
        demo: false,
        conversation_id: convId,
        request_id: d.request_id,
        generated_by: "test protocol fixture",
        sources: [
          {
            id: "S1:E1",
            document_id: docId,
            title: "مصدر اختبار المتصفح",
            section: "مقطع",
            quote: "مقطع اختبار واجهة فقط.",
            excerpt: "مقطع اختبار واجهة فقط.",
          },
        ],
      },
    });
  });
  await page.goto("/assistant");
  await page.getByLabel("سؤالك للمساعد الذكي").fill("How do I use VPN?");
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  await expect(page.getByLabel("إجابة مسار")).toContainText("إجابة اختبار عقد");
  expect(question).toBe("How do I use VPN?");
  expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
  await page.locator(".answer-sources a").click();
  await expect(page.locator(".demo-document-reader")).toContainText(
    "مقطع اختبار واجهة فقط.",
  );
  await page.route("**/api/v1/assistant/ask", (r) =>
    r.fulfill({
      status: 503,
      json: { error: { message: "توقف الاستدلال بسبب حد الاستخدام." } },
    }),
  );
  await page.goto("/assistant");
  await page.getByLabel("سؤالك للمساعد الذكي").fill("سؤال عربي VPN");
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  await expect(page.getByRole("alert")).toContainText("حد الاستخدام");
  await expect(page.getByLabel("إجابة مسار")).toHaveCount(0);
});
test("admin department, upload and invitation forms submit", async ({
  page,
}) => {
  await workspace(page, "company_admin");
  let department = "";
  await page.route("**/api/v1/departments", (r) => {
    if (r.request().method() === "POST") {
      department = r.request().postDataJSON().name;
      return r.fulfill({
        status: 201,
        json: [{ id: "department", name: department }],
      });
    }
    return r.fulfill({
      json: department
        ? [{ id: "department", name: department, description: "وصف اختبار" }]
        : [],
    });
  });
  await page.goto("/departments");
  await page
    .getByLabel("اسم القسم", { exact: true })
    .fill("تقنية المعلومات (IT)");
  await page.getByLabel("المسؤوليات والوصف").fill("وصف اختبار");
  await page.getByRole("button", { name: "حفظ القسم" }).click();
  await expect(page.locator(".department-card")).toContainText(
    "تقنية المعلومات",
  );
  await page.route("**/api/v1/documents", (r) =>
    r.request().method() === "POST"
      ? r.fulfill({ status: 201, json: { id: docId, status: "draft" } })
      : r.fulfill({ json: [] }),
  );
  await page.goto("/knowledge");
  await page.getByLabel("العنوان", { exact: true }).fill("وثيقة اختبار");
  await page.getByLabel("الملف", { exact: true }).setInputFiles({
    name: "browser-test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Test fixture only"),
  });
  await page.getByRole("button", { name: "رفع المستند", exact: true }).click();
  await expect(
    page.getByText("رُفع الملف بأمان. ستظهر حالته عند اكتمال المعالجة."),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("اسم المدعو").fill("اسم اختبار");
  await page
    .getByLabel("البريد الإلكتروني", { exact: true })
    .fill("invite@example.invalid");
  await page.getByRole("button", { name: "دعوة عضو" }).click();
  await expect(page.getByText("أُرسلت الدعوة وأُنشئت العضوية.")).toBeVisible();
});
test("private history and expired session handling", async ({ page }) => {
  await workspace(page);
  await page.route("**/api/v1/conversations", (r) =>
    r.fulfill({
      json: [
        {
          id: convId,
          title: "محادثة اختبار خاصة",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    }),
  );
  await page.route("**/api/v1/conversations/*/messages", (r) =>
    r.fulfill({
      json: [
        {
          id: "message",
          role: "user",
          content: "سؤال محفوظ للاختبار",
          citations: [],
        },
      ],
    }),
  );
  await page.goto("/history");
  await page.getByRole("link", { name: /محادثة اختبار خاصة/ }).click();
  await expect(page.locator(".thread")).toContainText("سؤال محفوظ للاختبار");
  await page.route("**/api/v1/assistant/ask", (r) =>
    r.fulfill({ status: 401, json: { error: { message: "انتهت الجلسة." } } }),
  );
  await page.getByLabel("سؤالك للمساعد الذكي").fill("سؤال جديد");
  await page.getByRole("button", { name: "إرسال السؤال" }).click();
  await expect(page).toHaveURL(/login/);
});
test("Arabic screens pass automated accessibility checks", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await workspace(page, "company_admin");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of [
    "/",
    "/assistant",
    "/departments",
    "/knowledge",
    "/history",
    "/settings",
    "/login",
    "/reset-password",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  }
});

test("deep-linked original source opens beyond the document list window", async ({
  page,
}) => {
  await workspace(page);
  await page.route("**/api/v1/documents/" + docId, (r) =>
    r.fulfill({
      json: {
        id: docId,
        title: "مصدر محفوظ خارج القائمة",
        status: "published",
        original_name: "source.txt",
      },
    }),
  );
  await page.route("**/api/v1/documents/" + docId + "/chunks", (r) =>
    r.fulfill({
      json: [
        {
          id: "chunk",
          content: "نص المصدر المسموح للاختبار فقط.",
          page_number: null,
        },
      ],
    }),
  );
  await page.goto("/knowledge?document=" + docId);
  await expect(page.locator(".demo-document-reader")).toContainText(
    "مصدر محفوظ خارج القائمة",
  );
  await expect(page.locator(".demo-document-reader")).toContainText(
    "نص المصدر المسموح للاختبار فقط.",
  );
});
