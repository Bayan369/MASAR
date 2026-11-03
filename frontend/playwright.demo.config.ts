import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e-demo",
  use: {
    baseURL: "http://127.0.0.1:5175",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    },
  },
  webServer: {
    command:
      "npm run build && npm exec vite preview -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175/demo",
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
