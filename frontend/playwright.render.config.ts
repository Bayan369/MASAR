import { defineConfig } from "@playwright/test";
import workspace from "./playwright.demo.config";
export default defineConfig({
  ...workspace,
  testDir: "./e2e-render",
  workers: 1,
  use: { ...workspace.use, baseURL: "http://127.0.0.1:5178" },
  webServer: [
    {
      cwd: "../backend",
      command:
        "uv run --frozen --no-dev python -m uvicorn render_transport_app:app --app-dir tests --host 127.0.0.1 --port 8018 --no-proxy-headers --no-access-log",
      url: "http://127.0.0.1:8018/api/v1/health",
      reuseExistingServer: false,
    },
    {
      command:
        "npm exec vite build -- --mode test && npm exec vite preview -- --host 127.0.0.1 --port 5178 --strictPort",
      env: {
        VITE_ASSISTANT_MODE: "llama",
        VITE_API_BASE_URL: "http://127.0.0.1:8018",
      },
      url: "http://127.0.0.1:5178/assistant",
      reuseExistingServer: false,
    },
  ],
});
