import connectDB from "@/lib/db";
import UserNotification from "@/models/UserNotification";
import { requireAuth } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/api";
import mongoose from "mongoose";

function serialize(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    read: Boolean(doc.read),
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    metadata: doc.metadata || {},
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
  };
}

export async function GET(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const userId = auth.payload.sub;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 30));

  await connectDB();
  const uid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const [items, unreadCount] = await Promise.all([
    UserNotification.find({ userId: uid }).sort({ createdAt: -1 }).limit(limit).lean(),
    UserNotification.countDocuments({ userId: uid, read: false }),
  ]);

  return ok({
    data: {
      items: items.map(serialize),
      unreadCount,
    },
  });
}

export async function PATCH(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const userId = auth.payload.sub;
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  await connectDB();
  const uid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const now = new Date();

  if (body?.markAll === true) {
    const res = await UserNotification.updateMany({ userId: uid, read: false }, { $set: { read: true, readAt: now } });
    return ok({ data: { modified: res.modifiedCount } });
  }

  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
  if (!ids.length) return fail("Provide ids[] or markAll", 400);

  const oids = ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!oids.length) return fail("No valid ids", 400);

  const res = await UserNotification.updateMany(
    { userId: uid, _id: { $in: oids }, read: false },
    { $set: { read: true, readAt: now } }
  );
  return ok({ data: { modified: res.modifiedCount } });
}
