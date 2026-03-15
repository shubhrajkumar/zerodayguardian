import process from "node:process";
import path from "node:path";
import { ensureMongo, spawnCommand } from "./dev-runtime.mjs";

const mongo = await ensureMongo();
const sharedEnv = {
  ...process.env,
  NEUROBOT_PORT: process.env.NEUROBOT_PORT || "8787",
  ALLOW_PORT_FALLBACK: "true",
};
const server = spawnCommand("node", ["backend/src/server.mjs"], { env: sharedEnv });
const viteScript = path.resolve("node_modules", "vite", "bin", "vite.js");
const web = spawnCommand(process.execPath, [viteScript], { env: sharedEnv });

const shutdown = () => {
  if (mongo && !mongo.killed) mongo.kill();
  server.kill();
  web.kill();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
