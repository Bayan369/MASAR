import { defineConfig } from "@playwright/test";
import workspace from "./playwright.demo.config";
export default defineConfig({
  ...workspace,
  testDir: "./e2e-public-demo",
  webServer: {
    command: "npm run build && node scripts/serve-vercel-build.mjs",
    env: { VITE_ASSISTANT_MODE: "llama" },
    url: "http://127.0.0.1:5175/assistant",
    reuseExistingServer: false,
  },
});
