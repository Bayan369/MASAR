import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export function resolveLocalApiOrigin(mode: string, envDir: string) {
  const env = loadEnv(mode, envDir, "MASAR_LOCAL_API_ORIGIN");
  return (
    process.env.MASAR_LOCAL_API_ORIGIN ||
    env.MASAR_LOCAL_API_ORIGIN ||
    "http://127.0.0.1:8000"
  );
}

export default defineConfig(({ mode }) => {
  const apiOrigin = resolveLocalApiOrigin(
    mode,
    fileURLToPath(new URL(".", import.meta.url)),
  );
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api/demo/documents": {
          target: apiOrigin,
          changeOrigin: true,
          rewrite: (path) =>
            path.replace("/api/demo/documents", "/api/v1/demo/documents"),
        },
        "/api/demo/ask": {
          target: apiOrigin,
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
  };
});
