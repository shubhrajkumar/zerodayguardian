import process from "node:process";
import { ensureMongo, spawnCommand } from "./dev-runtime.mjs";

const mongo = await ensureMongo();
const sharedEnv = {
  ...process.env,
  NEUROBOT_PORT: process.env.NEUROBOT_PORT || "8787",
  ALLOW_PORT_FALLBACK: "false",
};
const server = spawnCommand("node", ["server.js"], { env: sharedEnv });

const shutdown = () => {
  if (mongo && !mongo.killed) mongo.kill();
  server.kill();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
