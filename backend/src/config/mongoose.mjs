import mongoose from "mongoose";
import { env } from "./env.mjs";
import { logInfo, logWarn, logError } from "../utils/logger.mjs";

let connected = false;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const attachConnectionHandlers = () => {
  mongoose.connection.on("connected", () => {
    logInfo("Mongoose connection established");
  });

  mongoose.connection.on("error", (err) => {
    logError("Mongoose connection error", err, {
      message: String(err?.message || err),
    });
  });

  mongoose.connection.on("disconnected", () => {
    logWarn("Mongoose disconnected");
    connected = false;
  });

  mongoose.connection.on("reconnected", () => {
    logInfo("Mongoose reconnected");
    connected = true;
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectMongoose = async (options = {}) => {
  if (connected) return mongoose;

  const uri = String(env.mongoUri || process.env.MONGODB_URI || "");
  if (!uri) {
    logWarn("Mongoose connection skipped: MONGODB_URI not configured.");
    return null;
  }

  const maxRetries = options.maxRetries || MAX_RETRIES;
  const retryDelay = options.retryDelay || RETRY_DELAY_MS;

  attachConnectionHandlers();

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || "neurobot",
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
      });
      connected = true;
      logInfo("Mongoose connected successfully", {
        dbName: process.env.MONGODB_DB_NAME || "neurobot",
        attempt,
      });
      return mongoose;
    } catch (error) {
      logWarn(`Mongoose connection attempt ${attempt}/${maxRetries} failed`, {
        code: String(error?.code || ""),
        name: String(error?.name || ""),
        message: String(error?.message || "Connection failed"),
      });

      if (attempt < maxRetries) {
        const backoff = retryDelay * attempt;
        logInfo(`Retrying mongoose connection in ${backoff}ms...`);
        await sleep(backoff);
      } else {
        logError("Mongoose connection failed after all retries", error, {
          uri: uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@"),
          attempts: maxRetries,
        });
        throw error;
      }
    }
  }

  throw new Error("Mongoose connection failed: unexpected error");
};

export const disconnectMongoose = async () => {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  logInfo("Mongoose disconnected");
};

export const mongooseConnection = () => mongoose.connection;
