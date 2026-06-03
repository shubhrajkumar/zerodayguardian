import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";

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
    plugins: [
      react(),
      // Sentry source map upload (opt-in via SENTRY_AUTH_TOKEN env var)
      ...(process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG || "",
              project: process.env.SENTRY_PROJECT || "",
              authToken: process.env.SENTRY_AUTH_TOKEN,
            }),
          ]
        : []),
      visualizer({
        filename: "dist/stats-treemap.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    ],
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
      modulePreload: { polyfill: false },
      cssCodeSplit: true,
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 500,
      minify: "esbuild",
      esbuild: {
        drop: ["debugger"],
        pure: ["console.log"],
        legalComments: "none",
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            // Core React: minimal critical chunk
            if (id.includes("react") && !id.includes("react-router") && !id.includes("react-helmet") && !id.includes("react-hot-toast") && !id.includes("sonner") && !id.includes("react-hook-form") && !id.includes("react-day-picker") && !id.includes("react-window")) return "react-vendor";
            // Router: loaded with React but separated
            if (id.includes("react-router") || id.includes("@remix-run")) return "router-vendor";
            // Firebase: largest vendor — deferred
            if (id.includes("firebase")) return "firebase-vendor";
            // Framer Motion: deferred (only needed for animations)
            if (id.includes("framer-motion")) return "motion-vendor";
            // Charts: deferred (only needed on dashboard)
            if (id.includes("recharts")) return "charts-vendor";
            // Sentry: deferred (only needed for monitoring)
            if (id.includes("@sentry")) return "sentry-vendor";
            // Radix UI: deferred
            if (id.includes("@radix-ui")) return "ui-vendor";
            // Icons: deferred
            if (id.includes("lucide-react")) return "icons-vendor";
            // Toast/notifications: deferred
            if (id.includes("react-hot-toast") || id.includes("sonner")) return "toast-vendor";
            // Helmet: deferred
            if (id.includes("react-helmet-async")) return "helmet-vendor";
            // Query: deferred
            if (id.includes("@tanstack") || id.includes("react-query")) return "query-vendor";
            // Forms: deferred
            if (id.includes("react-hook-form") || id.includes("@hookform")) return "forms-vendor";
            // Date: deferred
            if (id.includes("date-fns") || id.includes("react-day-picker")) return "date-vendor";
            // Other small vendors: bundle together
            if (id.includes("zod") || id.includes("cmdk") || id.includes("canvas-confetti") || id.includes("html2canvas") || id.includes("embla-carousel") || id.includes("react-window")) return "misc-vendor";
          },
        },
      },
    },
  };
});
