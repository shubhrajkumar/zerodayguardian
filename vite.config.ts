import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const trimTrailingSlash = (value = "") => String(value || "").replace(/\/+$/, "");

const resolveBackendTarget = (defaultPort: string) =>
  process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${defaultPort}`;

const resolvePyApiTarget = (defaultPort: string) =>
  process.env.VITE_PY_API_URL || process.env.VITE_PY_API_PROXY_TARGET || `http://127.0.0.1:${defaultPort}`;

const resolveBackendPublicUrl = () =>
  trimTrailingSlash(process.env.VITE_API_BASE_URL || process.env.BACKEND_PUBLIC_URL || "");

const resolvePyApiPublicUrl = (backendPublicUrl: string) => {
  const explicitPyApiUrl = trimTrailingSlash(process.env.VITE_PY_API_URL || process.env.PY_API_PUBLIC_URL || "");
  if (explicitPyApiUrl) return explicitPyApiUrl;
  return backendPublicUrl ? `${backendPublicUrl}/pyapi` : "";
};

// https://vitejs.dev/config/
export default defineConfig(() => {
  const apiTarget = resolveBackendTarget(process.env.NEUROBOT_PORT || "8787");
  const pyApiTarget = resolvePyApiTarget(process.env.PY_API_PORT || "8000");
  const backendPublicUrl = resolveBackendPublicUrl();
  const pyApiPublicUrl = resolvePyApiPublicUrl(backendPublicUrl);
  const siteUrl = trimTrailingSlash(process.env.VITE_SITE_URL || process.env.APP_BASE_URL || "");

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
    define: {
      __BACKEND_PUBLIC_URL__: JSON.stringify(backendPublicUrl),
      __PY_API_PUBLIC_URL__: JSON.stringify(pyApiPublicUrl),
      __SITE_URL__: JSON.stringify(siteUrl),
    },
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
