import { createClient } from "redis";
import { env } from "./env.mjs";
import { logWarn } from "../utils/logger.mjs";

let redis;

export const connectRedis = async () => {
  if (!env.redisUrl) return null;
  if (redis?.isOpen) return redis;
  redis = createClient({
    url: env.redisUrl,
    socket: {
      connectTimeout: 1800,
      reconnectStrategy: (retries) => {
        const base = Math.min(2000, 100 + retries * 120);
        const jitter = Math.floor(Math.random() * 180);
        return base + jitter;
      },
    },
  });
  redis.on("error", (error) => {
    logWarn("Redis client error", { code: String(error?.code || ""), message: String(error?.message || "") });
  });
  await redis.connect();
  await redis.ping();
  return redis;
};

export const getRedis = () => {
  if (!redis?.isOpen) throw new Error("Redis not initialized. Call connectRedis first.");
  return redis;
};

export const verifyRedisConnection = async () => {
  const client = getRedis();
  const pong = await client.ping();
  return pong === "PONG";
};

export const closeRedis = async () => {
  if (redis?.isOpen) {
    await redis.quit();
  }
};
