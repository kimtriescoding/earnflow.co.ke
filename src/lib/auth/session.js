import connectDB from "@/lib/db";
import RefreshSession from "@/models/RefreshSession";
import { createRefreshJti, setAuthCookies } from "./jwt";

const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export async function issueAuthSession(payload, metadata = {}) {
  await connectDB();
  const jti = createRefreshJti();
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_SEC * 1000);
  await RefreshSession.create({
    userId: payload.sub,
    jti,
    expiresAt,
    metadata,
  });
  await setAuthCookies({ ...payload, jti });
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
