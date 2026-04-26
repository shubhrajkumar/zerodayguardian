import process from "node:process";
import path from "node:path";
import { ensureMongo, spawnCommand } from "./dev-runtime.mjs";

const mongo = await ensureMongo();
const nodePort = process.env.NEUROBOT_PORT || "8787";
const pyPort = process.env.PY_API_PORT || "8000";
const sharedEnv = {
  ...process.env,
  NEUROBOT_PORT: nodePort,
  PY_API_PORT: pyPort,
  PY_API_INTERNAL_URL: process.env.PY_API_INTERNAL_URL || `http://127.0.0.1:${pyPort}`,
  VITE_API_PROXY_TARGET: process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${nodePort}`,
  VITE_PY_API_PROXY_TARGET: process.env.VITE_PY_API_PROXY_TARGET || `http://127.0.0.1:${pyPort}`,
  ALLOW_PORT_FALLBACK: "true",
};
const server = spawnCommand("node", ["backend/server.js"], { env: sharedEnv });
const pyServer = spawnCommand("python", ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", pyPort], {
  env: sharedEnv,
  cwd: path.resolve("backend", "python"),
});
const viteScript = path.resolve("node_modules", "vite", "bin", "vite.js");
const web = spawnCommand(process.execPath, [viteScript], { env: sharedEnv });

const shutdown = () => {
  if (mongo && !mongo.killed) mongo.kill();
  server.kill();
  pyServer.kill();
  web.kill();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
