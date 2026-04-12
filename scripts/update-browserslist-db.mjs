import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (command, args, { silent = false } = {}) =>
  spawnSync(command, args, {
    stdio: silent ? "pipe" : "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

const hasBunLock = existsSync("bun.lockb");
const bunCheck = run("bun", ["--version"], { silent: true });
const hasBun = bunCheck.status === 0;

if (!hasBunLock || hasBun) {
  const res = run("npx", ["update-browserslist-db@latest", "--update-db"]);
  if (res.status === 0) process.exit(0);
}

  process.stdout.write("[browserslist] Falling back to npm update for caniuse-lite/browserslist\n");
const fallback = run("npm", ["update", "caniuse-lite", "browserslist"]);
process.exit(fallback.status ?? 1);
