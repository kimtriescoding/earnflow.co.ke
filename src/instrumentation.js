/** Runs once per Next.js server worker (Node runtime only). Dynamic import keeps `db.js` off the Edge instrumentation bundle. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const mod = await import("./instrumentation/mongoose-shutdown.js");
  mod.registerMongooseShutdown();
}
