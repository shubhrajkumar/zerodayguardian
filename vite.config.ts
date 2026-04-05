import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
const resolveBackendTarget = (defaultPort: string) =>
  process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${defaultPort}`;

const resolvePyApiTarget = (defaultPort: string) =>
  process.env.VITE_PY_API_URL || process.env.VITE_PY_API_PROXY_TARGET || `http://127.0.0.1:${defaultPort}`;

// https://vitejs.dev/config/
export default defineConfig(() => {
  const apiTarget = resolveBackendTarget(process.env.NEUROBOT_PORT || "8787");
  const pyApiTarget = resolvePyApiTarget(process.env.PY_API_PORT || "8000");

  return {
    server: {
      host: "0.0.0.0",
      port: 8080,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false, // Added secure false as requested
        },
        "/pyapi": {
          target: pyApiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2020",
      sourcemap: false,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("react-router") || id.includes("@remix-run")) return "router-vendor";
            if (id.includes("react-helmet-async") || id.includes("react-hot-toast") || id.includes("sonner")) return "react-ui-vendor";
            if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
            if (id.includes("@tanstack") || id.includes("react-query")) return "query-vendor";
            if (id.includes("firebase")) return "firebase-vendor";
            if (id.includes("framer-motion")) return "motion-vendor";
            if (id.includes("recharts")) return "charts-vendor";
            if (id.includes("lucide-react") || id.includes("@radix-ui")) return "ui-vendor";
          },
        },
      },
    },
  };
});
