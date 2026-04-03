import mongoose from "mongoose";
import { env } from "./env.mjs";
import { logInfo, logWarn } from "../utils/logger.mjs";

let connected = false;

export const connectMongoose = async () => {
  if (connected) return mongoose;
  const uri = String(env.mongoUri || process.env.MONGODB_URI || "");
  if (!uri) {
    logWarn("Mongoose connection skipped: MONGODB_URI not configured.");
    return null;
  }
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || "neurobot",
    maxPoolSize: 20,
  });
  connected = true;
  logInfo("Mongoose connected.");
  return mongoose;
};

export const disconnectMongoose = async () => {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
};

export const mongooseConnection = () => mongoose.connection;
