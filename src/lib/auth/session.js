import connectDB from "@/lib/db";
import RefreshSession from "@/models/RefreshSession";
import { createRefreshJti, setAuthCookies } from "./jwt";

const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export async function issueAuthSession(payload, metadata = {}) {
  await connectDB();
  const jti = createRefreshJti();
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_SEC * 1000);
  const created = await RefreshSession.create({
    userId: payload.sub,
    jti,
    expiresAt,
    metadata,
  });
  await setAuthCookies({ ...payload, jti });
  if (metadata?.source === "login") {
    void pruneLoginRefreshSessions(payload.sub, String(created._id));
  }
}

async function pruneLoginRefreshSessions(userId, keepCreatedId) {
  try {
    await connectDB();
    const keepIds = await RefreshSession.find({
      userId,
      "metadata.source": "login",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id")
      .lean();
    if (keepIds.length < 5) return;
    const keepIdSet = new Set(keepIds.map((doc) => String(doc._id)));
    keepIdSet.add(keepCreatedId);
    await RefreshSession.deleteMany({
      userId,
      "metadata.source": "login",
      _id: { $nin: [...keepIdSet] },
    });
  } catch {
    /* non-critical housekeeping */
  }
}

export async function rotateRefreshSession({ currentJti, payload, metadata = {} }) {
  await connectDB();
  const active = await RefreshSession.findOne({
    jti: currentJti,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!active) return { ok: false };
  await RefreshSession.findOneAndUpdate({ jti: currentJti }, { revokedAt: new Date() });
  const newJti = createRefreshJti();
  await RefreshSession.create({
    userId: payload.sub,
    jti: newJti,
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_SEC * 1000),
    metadata,
  });
  await setAuthCookies({ ...payload, jti: newJti });
  return { ok: true };
}
