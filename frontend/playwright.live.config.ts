import { defineConfig } from "@playwright/test";
if (process.env.MASAR_RUN_LIVE_AI !== "true")
  throw new Error(
    "Live inference is opt-in. Set MASAR_RUN_LIVE_AI=true only after configuring Workers Free.",
  );
export default defineConfig({
  testDir: "./e2e-live",
  retries: 0,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    },
  },
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
    {
      command:
        "../backend/.venv/bin/uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/api/v1/health",
      reuseExistingServer: false,
    },
  ],
});
