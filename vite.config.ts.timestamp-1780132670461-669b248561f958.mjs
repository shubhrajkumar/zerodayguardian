// vite.config.ts
import { defineConfig } from "file:///C:/Users/ksubh/OneDrive/Desktop/AI%20web/zeroday-guardian-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ksubh/OneDrive/Desktop/AI%20web/zeroday-guardian-main/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { visualizer } from "file:///C:/Users/ksubh/OneDrive/Desktop/AI%20web/zeroday-guardian-main/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { sentryVitePlugin } from "file:///C:/Users/ksubh/OneDrive/Desktop/AI%20web/zeroday-guardian-main/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\ksubh\\OneDrive\\Desktop\\AI web\\zeroday-guardian-main";
var trimTrailingSlash = (value = "") => String(value || "").replace(/\/+$/, "");
var resolveBackendTarget = (defaultPort) => process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${defaultPort}`;
var resolvePyApiTarget = (defaultPort) => process.env.VITE_PY_API_URL || process.env.VITE_PY_API_PROXY_TARGET || `http://127.0.0.1:${defaultPort}`;
var resolveBackendPublicUrl = () => trimTrailingSlash(process.env.VITE_API_BASE_URL || process.env.BACKEND_PUBLIC_URL || "");
var resolvePyApiPublicUrl = (backendPublicUrl) => {
  const explicitPyApiUrl = trimTrailingSlash(process.env.VITE_PY_API_URL || process.env.PY_API_PUBLIC_URL || "");
  if (explicitPyApiUrl) return explicitPyApiUrl;
  return backendPublicUrl ? `${backendPublicUrl}/pyapi` : "";
};
var vite_config_default = defineConfig(() => {
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
          secure: false
          // Added secure false as requested
        },
        "/pyapi": {
          target: pyApiTarget,
          changeOrigin: true,
          secure: false
        }
      },
      hmr: {
        overlay: false
      }
    },
    plugins: [
      react(),
      // Sentry source map upload (opt-in via SENTRY_AUTH_TOKEN env var)
      ...process.env.SENTRY_AUTH_TOKEN ? [
        sentryVitePlugin({
          org: process.env.SENTRY_ORG || "",
          project: process.env.SENTRY_PROJECT || "",
          authToken: process.env.SENTRY_AUTH_TOKEN
        })
      ] : [],
      visualizer({
        filename: "dist/stats-treemap.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false
      })
    ],
    define: {
      __BACKEND_PUBLIC_URL__: JSON.stringify(backendPublicUrl),
      __PY_API_PUBLIC_URL__: JSON.stringify(pyApiPublicUrl),
      __SITE_URL__: JSON.stringify(siteUrl)
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    build: {
      target: "es2020",
      sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1e3,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("react-router") || id.includes("@remix-run")) return "router-vendor";
            if (id.includes("react-helmet-async") || id.includes("react-hot-toast") || id.includes("sonner")) return "react-ui-vendor";
            if (id.includes("lucide-react")) return "icons-vendor";
            if (id.includes("react-day-picker")) return "datepicker-vendor";
            if (id.includes("react-hook-form") || id.includes("@hookform")) return "forms-vendor";
            if (id.includes("react-window")) return "virtual-vendor";
            if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
            if (id.includes("@tanstack") || id.includes("react-query")) return "query-vendor";
            if (id.includes("firebase")) return "firebase-vendor";
            if (id.includes("framer-motion")) return "motion-vendor";
            if (id.includes("recharts")) return "charts-vendor";
            if (id.includes("@radix-ui")) return "ui-vendor";
            if (id.includes("canvas-confetti")) return "confetti-vendor";
            if (id.includes("date-fns")) return "date-vendor";
            if (id.includes("zod")) return "validation-vendor";
            if (id.includes("cmdk")) return "command-vendor";
            if (id.includes("html2canvas") || id.includes("embla-carousel")) return "ui-utils-vendor";
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxrc3ViaFxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXEFJIHdlYlxcXFx6ZXJvZGF5LWd1YXJkaWFuLW1haW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGtzdWJoXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcQUkgd2ViXFxcXHplcm9kYXktZ3VhcmRpYW4tbWFpblxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMva3N1YmgvT25lRHJpdmUvRGVza3RvcC9BSSUyMHdlYi96ZXJvZGF5LWd1YXJkaWFuLW1haW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdmlzdWFsaXplclwiO1xyXG5pbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSBcIkBzZW50cnkvdml0ZS1wbHVnaW5cIjtcclxuXHJcbmNvbnN0IHRyaW1UcmFpbGluZ1NsYXNoID0gKHZhbHVlID0gXCJcIikgPT4gU3RyaW5nKHZhbHVlIHx8IFwiXCIpLnJlcGxhY2UoL1xcLyskLywgXCJcIik7XHJcblxyXG5jb25zdCByZXNvbHZlQmFja2VuZFRhcmdldCA9IChkZWZhdWx0UG9ydDogc3RyaW5nKSA9PlxyXG4gIHByb2Nlc3MuZW52LlZJVEVfQVBJX1BST1hZX1RBUkdFVCB8fCBgaHR0cDovLzEyNy4wLjAuMToke2RlZmF1bHRQb3J0fWA7XHJcblxyXG5jb25zdCByZXNvbHZlUHlBcGlUYXJnZXQgPSAoZGVmYXVsdFBvcnQ6IHN0cmluZykgPT5cclxuICBwcm9jZXNzLmVudi5WSVRFX1BZX0FQSV9VUkwgfHwgcHJvY2Vzcy5lbnYuVklURV9QWV9BUElfUFJPWFlfVEFSR0VUIHx8IGBodHRwOi8vMTI3LjAuMC4xOiR7ZGVmYXVsdFBvcnR9YDtcclxuXHJcbmNvbnN0IHJlc29sdmVCYWNrZW5kUHVibGljVXJsID0gKCkgPT5cclxuICB0cmltVHJhaWxpbmdTbGFzaChwcm9jZXNzLmVudi5WSVRFX0FQSV9CQVNFX1VSTCB8fCBwcm9jZXNzLmVudi5CQUNLRU5EX1BVQkxJQ19VUkwgfHwgXCJcIik7XHJcblxyXG5jb25zdCByZXNvbHZlUHlBcGlQdWJsaWNVcmwgPSAoYmFja2VuZFB1YmxpY1VybDogc3RyaW5nKSA9PiB7XHJcbiAgY29uc3QgZXhwbGljaXRQeUFwaVVybCA9IHRyaW1UcmFpbGluZ1NsYXNoKHByb2Nlc3MuZW52LlZJVEVfUFlfQVBJX1VSTCB8fCBwcm9jZXNzLmVudi5QWV9BUElfUFVCTElDX1VSTCB8fCBcIlwiKTtcclxuICBpZiAoZXhwbGljaXRQeUFwaVVybCkgcmV0dXJuIGV4cGxpY2l0UHlBcGlVcmw7XHJcbiAgcmV0dXJuIGJhY2tlbmRQdWJsaWNVcmwgPyBgJHtiYWNrZW5kUHVibGljVXJsfS9weWFwaWAgOiBcIlwiO1xyXG59O1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCgpID0+IHtcclxuICBjb25zdCBhcGlUYXJnZXQgPSByZXNvbHZlQmFja2VuZFRhcmdldChwcm9jZXNzLmVudi5ORVVST0JPVF9QT1JUIHx8IFwiODc4N1wiKTtcclxuICBjb25zdCBweUFwaVRhcmdldCA9IHJlc29sdmVQeUFwaVRhcmdldChwcm9jZXNzLmVudi5QWV9BUElfUE9SVCB8fCBcIjgwMDBcIik7XHJcbiAgY29uc3QgYmFja2VuZFB1YmxpY1VybCA9IHJlc29sdmVCYWNrZW5kUHVibGljVXJsKCk7XHJcbiAgY29uc3QgcHlBcGlQdWJsaWNVcmwgPSByZXNvbHZlUHlBcGlQdWJsaWNVcmwoYmFja2VuZFB1YmxpY1VybCk7XHJcbiAgY29uc3Qgc2l0ZVVybCA9IHRyaW1UcmFpbGluZ1NsYXNoKHByb2Nlc3MuZW52LlZJVEVfU0lURV9VUkwgfHwgcHJvY2Vzcy5lbnYuQVBQX0JBU0VfVVJMIHx8IFwiXCIpO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IFwiMC4wLjAuMFwiLFxyXG4gICAgICBwb3J0OiA4MDgwLFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgIFwiL2FwaVwiOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6IGFwaVRhcmdldCxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsIC8vIEFkZGVkIHNlY3VyZSBmYWxzZSBhcyByZXF1ZXN0ZWRcclxuICAgICAgICB9LFxyXG4gICAgICAgIFwiL3B5YXBpXCI6IHtcclxuICAgICAgICAgIHRhcmdldDogcHlBcGlUYXJnZXQsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGhtcjoge1xyXG4gICAgICAgIG92ZXJsYXk6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgcmVhY3QoKSxcclxuICAgICAgLy8gU2VudHJ5IHNvdXJjZSBtYXAgdXBsb2FkIChvcHQtaW4gdmlhIFNFTlRSWV9BVVRIX1RPS0VOIGVudiB2YXIpXHJcbiAgICAgIC4uLihwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTlxyXG4gICAgICAgID8gW1xyXG4gICAgICAgICAgICBzZW50cnlWaXRlUGx1Z2luKHtcclxuICAgICAgICAgICAgICBvcmc6IHByb2Nlc3MuZW52LlNFTlRSWV9PUkcgfHwgXCJcIixcclxuICAgICAgICAgICAgICBwcm9qZWN0OiBwcm9jZXNzLmVudi5TRU5UUllfUFJPSkVDVCB8fCBcIlwiLFxyXG4gICAgICAgICAgICAgIGF1dGhUb2tlbjogcHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU4sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIDogW10pLFxyXG4gICAgICB2aXN1YWxpemVyKHtcclxuICAgICAgICBmaWxlbmFtZTogXCJkaXN0L3N0YXRzLXRyZWVtYXAuaHRtbFwiLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcInRyZWVtYXBcIixcclxuICAgICAgICBnemlwU2l6ZTogdHJ1ZSxcclxuICAgICAgICBicm90bGlTaXplOiB0cnVlLFxyXG4gICAgICAgIG9wZW46IGZhbHNlLFxyXG4gICAgICB9KSxcclxuICAgIF0sXHJcbiAgICBkZWZpbmU6IHtcclxuICAgICAgX19CQUNLRU5EX1BVQkxJQ19VUkxfXzogSlNPTi5zdHJpbmdpZnkoYmFja2VuZFB1YmxpY1VybCksXHJcbiAgICAgIF9fUFlfQVBJX1BVQkxJQ19VUkxfXzogSlNPTi5zdHJpbmdpZnkocHlBcGlQdWJsaWNVcmwpLFxyXG4gICAgICBfX1NJVEVfVVJMX186IEpTT04uc3RyaW5naWZ5KHNpdGVVcmwpLFxyXG4gICAgfSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXHJcbiAgICAgIHNvdXJjZW1hcDogcHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU4gPyBcImhpZGRlblwiIDogZmFsc2UsXHJcbiAgICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiBmYWxzZSxcclxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcclxuICAgICAgICAgICAgaWYgKCFpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSkgcmV0dXJuO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWFjdC1yb3V0ZXJcIikgfHwgaWQuaW5jbHVkZXMoXCJAcmVtaXgtcnVuXCIpKSByZXR1cm4gXCJyb3V0ZXItdmVuZG9yXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlYWN0LWhlbG1ldC1hc3luY1wiKSB8fCBpZC5pbmNsdWRlcyhcInJlYWN0LWhvdC10b2FzdFwiKSB8fCBpZC5pbmNsdWRlcyhcInNvbm5lclwiKSkgcmV0dXJuIFwicmVhY3QtdWktdmVuZG9yXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImx1Y2lkZS1yZWFjdFwiKSkgcmV0dXJuIFwiaWNvbnMtdmVuZG9yXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlYWN0LWRheS1waWNrZXJcIikpIHJldHVybiBcImRhdGVwaWNrZXItdmVuZG9yXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlYWN0LWhvb2stZm9ybVwiKSB8fCBpZC5pbmNsdWRlcyhcIkBob29rZm9ybVwiKSkgcmV0dXJuIFwiZm9ybXMtdmVuZG9yXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlYWN0LXdpbmRvd1wiKSkgcmV0dXJuIFwidmlydHVhbC12ZW5kb3JcIjtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVhY3RcIikgfHwgaWQuaW5jbHVkZXMoXCJzY2hlZHVsZXJcIikpIHJldHVybiBcInJlYWN0LXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAdGFuc3RhY2tcIikgfHwgaWQuaW5jbHVkZXMoXCJyZWFjdC1xdWVyeVwiKSkgcmV0dXJuIFwicXVlcnktdmVuZG9yXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImZpcmViYXNlXCIpKSByZXR1cm4gXCJmaXJlYmFzZS12ZW5kb3JcIjtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiZnJhbWVyLW1vdGlvblwiKSkgcmV0dXJuIFwibW90aW9uLXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWNoYXJ0c1wiKSkgcmV0dXJuIFwiY2hhcnRzLXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAcmFkaXgtdWlcIikpIHJldHVybiBcInVpLXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJjYW52YXMtY29uZmV0dGlcIikpIHJldHVybiBcImNvbmZldHRpLXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJkYXRlLWZuc1wiKSkgcmV0dXJuIFwiZGF0ZS12ZW5kb3JcIjtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiem9kXCIpKSByZXR1cm4gXCJ2YWxpZGF0aW9uLXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJjbWRrXCIpKSByZXR1cm4gXCJjb21tYW5kLXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJodG1sMmNhbnZhc1wiKSB8fCBpZC5pbmNsdWRlcyhcImVtYmxhLWNhcm91c2VsXCIpKSByZXR1cm4gXCJ1aS11dGlscy12ZW5kb3JcIjtcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6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
