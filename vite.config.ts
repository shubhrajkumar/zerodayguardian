import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

const runtimePortManifestPath = path.resolve(__dirname, ".local/runtime/neurobot-port.json");

const readRuntimeBackendTarget = (defaultPort: string) => {
  const explicitTarget = process.env.VITE_API_PROXY_TARGET;
  if (explicitTarget) return explicitTarget;

  try {
    const payload = JSON.parse(fs.readFileSync(runtimePortManifestPath, "utf8")) as { port?: number };
    const runtimePort = Number(payload?.port || 0);
    if (Number.isFinite(runtimePort) && runtimePort > 0) {
      return `http://127.0.0.1:${runtimePort}`;
    }
  } catch {
    // ignore runtime manifest read errors and fall back to configured port
  }

  return `http://127.0.0.1:${defaultPort}`;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendPort = process.env.NEUROBOT_PORT || "8787";
  const apiTarget = readRuntimeBackendTarget(backendPort);
  const pyApiTarget = process.env.VITE_PY_API_URL || "http://127.0.0.1:9001";

  return {
    server: {
      host: "0.0.0.0",
      port: 8080,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          configure: (_proxy, options) => {
            options.target = readRuntimeBackendTarget(backendPort);
          },
        },
        "/pyapi": {
          target: pyApiTarget,
          changeOrigin: true,
        },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
