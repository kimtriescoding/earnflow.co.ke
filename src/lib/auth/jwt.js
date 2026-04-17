import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "../env";
import crypto from "node:crypto";

const encoder = new TextEncoder();
const ACCESS_COOKIE = "tw_access";
const REFRESH_COOKIE = "tw_refresh";

function getAccessSecret() {
  return encoder.encode(getEnv().JWT_ACCESS_SECRET);
}

function getRefreshSecret() {
  return encoder.encode(getEnv().JWT_REFRESH_SECRET);
}

export async function signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getAccessSecret());
}

export async function signRefreshToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getRefreshSecret());
}

export function createRefreshJti() {
  return crypto.randomUUID();
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getAccessSecret());
  return payload;
}

export async function verifyRefreshToken(token) {
  const { payload } = await jwtVerify(token, getRefreshSecret());
  return payload;
}

export async function setAuthCookies(payload) {
  const store = await cookies();
  const refreshPayload = { ...payload, jti: payload.jti || createRefreshJti() };
  const accessToken = await signAccessToken(refreshPayload);
  const refreshToken = await signRefreshToken(refreshPayload);
  const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
  store.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: 60 * 60 * 12 });
  store.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function readAccessPayloadFromCookies() {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export const authCookieNames = { ACCESS_COOKIE, REFRESH_COOKIE };
