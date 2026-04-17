import mongoose from "mongoose";
import { getEnv } from "./env";

const globalForMongo = globalThis;

if (!globalForMongo.__taskwaveMongo) {
  globalForMongo.__taskwaveMongo = { conn: null, promise: null };
}

export default async function connectDB() {
  const cache = globalForMongo.__taskwaveMongo;
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const { MONGODB_URI } = getEnv();
    cache.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 10000,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
