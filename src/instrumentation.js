/** Runs once per Next.js server worker (Node runtime only). Dynamic import keeps `db.js` off the Edge instrumentation bundle. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const mod = await import("./instrumentation/mongoose-shutdown.js");
  mod.registerMongooseShutdown();

  const { default: connectDB } = await import("./lib/db.js");
  try {
    await connectDB();
  } catch (err) {
    console.error("[instrumentation] DB warmup failed; will connect lazily on first request", err);
  }
}
