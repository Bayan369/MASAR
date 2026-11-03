import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/demo/documents": {
        target: process.env.MASAR_LOCAL_API_ORIGIN || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace("/api/demo/documents", "/api/v1/demo/documents"),
      },
      "/api/demo/ask": {
        target: process.env.MASAR_LOCAL_API_ORIGIN || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: () => "/api/v1/demo/ask",
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "supabase";
            if (/(?:react|scheduler)/.test(id)) return "react";
          }
        },
      },
    },
  },
});
