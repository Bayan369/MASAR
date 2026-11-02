// Synthetic identities/data for browser contract tests ONLY, never live evidence.
import type { Page } from "@playwright/test";
export const user = {
  id: "a0000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "browser@example.invalid",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
export const docId = "d0000000-0000-0000-0000-000000000001";
export const convId = "c0000000-0000-0000-0000-000000000001";
export const session = {
  access_token: "browser-contract-token",
  refresh_token: "browser-contract-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
export async function workspace(page: Page, role = "new_employee") {
  await page.addInitScript(
    ({ session }) => {
      localStorage.setItem(
        "sb-browser-contract-auth-token",
        JSON.stringify(session),
      );
    },
    { session },
  );
  await page.route("https://browser-contract.supabase.co/**", (route) =>
    route.fulfill({ status: 200, json: session }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (
      route.request().headers()["authorization"] !==
      "Bearer browser-contract-token"
    )
      return route.fulfill({
        status: 401,
        json: { error: { message: "missing token" } },
      });
    const data: Record<string, unknown> = {
      "/api/v1/me": {
        profile: {
          id: user.id,
          company_id: "10000000-0000-0000-0000-000000000001",
          role,
          display_name: "حساب اختبار المتصفح",
        },
        company: {
          id: "10000000-0000-0000-0000-000000000001",
          name: "شركة اختبار الواجهة فقط",
        },
      },
      "/api/v1/departments": [],
      "/api/v1/documents": [],
      "/api/v1/conversations": [],
      "/api/v1/members": [],
    };
    return route.fulfill({ status: 200, json: data[path] ?? [] });
  });
}
