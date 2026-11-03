import { defineConfig } from "@playwright/test";
import workspace from "./playwright.demo.config";
export default defineConfig({
  ...workspace,
  testDir: "./e2e-local-api",
  use: { ...workspace.use, baseURL: "http://127.0.0.1:5177" },
  webServer: [
    {
      cwd: "../backend",
      command: ".venv/bin/python -m scripts.start_server",
      env: {
        PORT: "8017",
        MASAR_ENVIRONMENT: "development",
        MASAR_DEMO_ENABLED: "true",
        MASAR_CLOUDFLARE_ACCOUNT_ID: "",
        MASAR_CLOUDFLARE_API_TOKEN: "",
      },
      url: "http://127.0.0.1:8017/api/v1/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5177 --strictPort",
      env: {
        VITE_ASSISTANT_MODE: "llama",
        MASAR_LOCAL_API_ORIGIN: "http://127.0.0.1:8017",
      },
      url: "http://127.0.0.1:5177/assistant",
      reuseExistingServer: false,
    },
  ],
});
