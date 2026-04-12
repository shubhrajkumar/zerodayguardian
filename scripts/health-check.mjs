import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { isPortListening, probeHttp } from "./dev-runtime.mjs";

const runtimePortManifestPath = path.resolve(".local", "runtime", "neurobot-port.json");
const readRuntimeBackendPort = () => {
  try {
    const payload = JSON.parse(fs.readFileSync(runtimePortManifestPath, "utf8"));
    const port = Number(payload?.port || 0);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {
    // ignore runtime manifest failures
  }
  return Number(process.env.NEUROBOT_PORT || 8787);
};

const backendPort = readRuntimeBackendPort();
const pyApiPort = Number(process.env.PY_API_PORT || 8000);
const frontendPorts = [Number(process.env.FRONTEND_PORT || 8080), 5173].filter((port, index, list) => list.indexOf(port) === index);
const checks = [
  {
    label: "MongoDB",
    run: async () => ({
      ok: await isPortListening(27017),
      detail: "127.0.0.1:27017",
    }),
  },
  {
    label: "Redis",
    run: async () => ({
      ok: await isPortListening(6379),
      detail: "127.0.0.1:6379",
    }),
  },
  {
    label: "Backend",
    run: async () => {
      const detail = `http://127.0.0.1:${backendPort}/health`;
      const result = await probeHttp(detail);
      return {
        ok: result.ok,
        detail: result.ok ? `${detail} -> ${result.status}` : `${detail} -> ${result.error || result.status}`,
      };
    },
  },
  {
    label: "PyAPI",
    run: async () => {
      const detail = `http://127.0.0.1:${pyApiPort}/health`;
      const result = await probeHttp(detail);
      return {
        ok: result.ok,
        detail: result.ok ? `${detail} -> ${result.status}` : `${detail} -> ${result.error || result.status}`,
      };
    },
  },
  {
    label: "Frontend",
    run: async () => {
      for (const port of frontendPorts) {
        const detail = `http://127.0.0.1:${port}/`;
         
        const result = await probeHttp(detail, 1800);
        if (result.ok) {
          return {
            ok: true,
            detail: `${detail} -> ${result.status}`,
          };
        }
      }
      return {
        ok: false,
        detail: `not reachable on ports ${frontendPorts.join(", ")}`,
      };
    },
  },
];

let failed = false;
for (const check of checks) {
   
  const result = await check.run();
  if (!result.ok) failed = true;
  const status = result.ok ? "OK" : "FAIL";
  process.stdout.write(`[${status}] ${check.label}: ${result.detail}\n`);
}

process.exitCode = failed ? 1 : 0;
