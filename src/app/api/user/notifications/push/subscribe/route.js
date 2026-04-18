import { z } from "zod";
import connectDB from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail, guardRateLimit } from "@/lib/api";
import mongoose from "mongoose";

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request) {
  const rl = guardRateLimit(request, "push_subscribe", 20, 60_000);
  if (rl) return rl;
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;

  let json;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues?.[0]?.message || "Invalid body", 400);

  await connectDB();
  const userId = auth.payload.sub;
  const uid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const ua = request.headers.get("user-agent") || "";

  await PushSubscription.findOneAndUpdate(
    { endpoint: parsed.data.endpoint },
    {
      userId: uid,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: ua.slice(0, 512),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return ok({ data: { ok: true } });
}

export async function DELETE(request) {
  const rl = guardRateLimit(request, "push_unsubscribe", 20, 60_000);
  if (rl) return rl;
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;

  let json;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const endpoint = typeof json?.endpoint === "string" ? json.endpoint : "";
  if (!endpoint) return fail("endpoint required", 400);

  await connectDB();
  const userId = auth.payload.sub;
  const uid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  await PushSubscription.deleteOne({ userId: uid, endpoint });
  return ok({ data: { ok: true } });
}
