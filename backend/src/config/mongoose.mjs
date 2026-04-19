import mongoose from "mongoose";
import { logInfo } from "../utils/logger.mjs";

let connected = false;
const MONGODB_URI = String(process.env.MONGODB_URI || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");

export const connectMongoose = async () => {
  if (connected) return mongoose;
  if (!MONGODB_URI) {
    throw new Error("Missing required environment variable: MONGODB_URI");
  }
  await mongoose.connect(MONGODB_URI, {
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
