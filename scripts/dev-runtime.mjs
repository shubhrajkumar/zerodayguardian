import { mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

export const MONGO_PORT = 27017;
const mongoRoot = path.resolve(".local", "mongo");
const mongoDataDir = path.join(mongoRoot, "data");
const mongoLogDir = path.join(mongoRoot, "log");
const mongoLogPath = path.join(mongoLogDir, "mongod.log");
const windowsMongoBinary = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";

export const isPortListening = (port, host = "127.0.0.1", timeoutMs = 800) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });

export const ensureMongo = async () => {
  if (await isPortListening(MONGO_PORT)) return null;
  if (process.platform !== "win32") return null;

  mkdirSync(mongoDataDir, { recursive: true });
  mkdirSync(mongoLogDir, { recursive: true });

  const mongo = spawn(
    windowsMongoBinary,
    [
      "--dbpath",
      mongoDataDir,
      "--bind_ip",
      "127.0.0.1",
      "--port",
      String(MONGO_PORT),
      "--logpath",
      mongoLogPath,
      "--wiredTigerCacheSizeGB",
      "0.25",
    ],
    {
      stdio: "ignore",
      windowsHide: true,
    }
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
     
    if (await isPortListening(MONGO_PORT)) return mongo;
     
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  mongo.kill();
  throw new Error(`MongoDB did not start on 127.0.0.1:${MONGO_PORT}`);
};

export const spawnCommand = (command, args, options = {}) =>
  spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

export const probeHttp = async (url, timeoutMs = 2500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status,
      url,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      error: String(error?.message || "request_failed"),
    };
  } finally {
    clearTimeout(timer);
  }
};
