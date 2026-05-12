import { registerMongoShutdown } from "@/lib/db";

/** Node-only: registers SIGTERM/SIGINT to disconnect Mongoose. Loaded via dynamic import from instrumentation. */
export function registerMongooseShutdown() {
  registerMongoShutdown();
}
