import { defineConfig } from "@playwright/test";
import workspace from "./playwright.demo.config";

export default defineConfig({
  ...workspace,
  testDir: ".",
  testMatch: ["e2e-demo/**/*.spec.ts", "e2e-vercel/**/*.spec.ts"],
  webServer: {
    command: "npm run build && node scripts/serve-vercel-build.mjs",
    url: "http://127.0.0.1:5175/assistant",
    reuseExistingServer: false,
  },
});
