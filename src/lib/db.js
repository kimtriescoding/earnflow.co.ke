import mongoose from "mongoose";
import { getEnv } from "./env";

/**
 * Single Mongoose connection for Next.js (App Router), Node workers, Docker/Coolify, etc.
 * Cached on globalThis so dev HMR does not spawn duplicate pools; production keeps one pool per process.
 *
 * URI notes (optional query params on MONGODB_URI — merged with options below; overlaps depend on driver merge rules):
 * - retryWrites=true — Atlas / replica writes (typical)
 * - w=majority — write concern
 * - tls=true — TLS to Atlas
 * - maxPoolSize / minPoolSize — may tune pool via URI instead of env below
 */
const CACHE_KEY = "__taskwaveMongoose";
const SHUTDOWN_HOOK_KEY = "__taskwaveMongooseShutdownHook";

const globalForMongo = globalThis;
if (!globalForMongo[CACHE_KEY]) {
  globalForMongo[CACHE_KEY] = { promise: null };
}

const cache = globalForMongo[CACHE_KEY];

function optionalPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function buildMongoClientOptions() {
  const maxPoolSize = optionalPositiveInt("MONGODB_MAX_POOL_SIZE", 50);
  const minPoolSize = Math.min(optionalPositiveInt("MONGODB_MIN_POOL_SIZE", 0), maxPoolSize);

  return {
    maxPoolSize,
    minPoolSize,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxIdleTimeMS: 60_000,
  };
}

/**
 * Ensures the default Mongoose connection is ready. Idempotent; safe under concurrent awaits.
 * All DB access should go through models after await connectDB() — do not call mongoose.connect elsewhere.
 *
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!cache.promise) {
    const { MONGODB_URI } = getEnv();
    cache.promise = mongoose
      .connect(MONGODB_URI, buildMongoClientOptions())
      .then(() => mongoose)
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }

  await cache.promise;
  return mongoose;
}

/**
 * Closes the Mongoose connection and clears the connect promise cache.
 * Idempotent; safe if already disconnected.
 */
async function disconnectDB() {
  cache.promise = null;
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
}

/**
 * Registers SIGTERM/SIGINT handlers once per process to disconnect cleanly (Docker/Coolify).
 * Does not call process.exit — Next.js handles server teardown.
 */
function registerMongoShutdown() {
  if (globalForMongo[SHUTDOWN_HOOK_KEY]) {
    return;
  }
  globalForMongo[SHUTDOWN_HOOK_KEY] = true;

  const run = () => {
    void disconnectDB().catch((err) => {
      console.error("[db] disconnect on shutdown failed", err);
    });
  };

  process.once("SIGTERM", run);
  process.once("SIGINT", run);
}

export default connectDB;
export { connectDB, disconnectDB, registerMongoShutdown };
