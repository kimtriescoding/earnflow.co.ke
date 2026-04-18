/**
 * Validates VAPID_* entries in .env without booting Next.js.
 * Usage: pnpm run vapid:verify
 */
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";

function normalizeVapidKey(value) {
  if (value === "" || value == null) return undefined;
  let s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  const out = s.replace(/\s+/g, "");
  return out || undefined;
}

function parseDotEnv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = process.cwd();
const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.error("No .env file found at", envPath);
  process.exit(1);
}

const raw = parseDotEnv(envPath);
const publicKey = normalizeVapidKey(raw.VAPID_PUBLIC_KEY);
const privateKey = normalizeVapidKey(raw.VAPID_PRIVATE_KEY);
const subject = normalizeVapidKey(raw.VAPID_SUBJECT);

if (!publicKey || !privateKey) {
  console.error("Missing VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY in .env");
  process.exit(1);
}

let buf;
try {
  buf = Buffer.from(publicKey, "base64url");
} catch {
  buf = Buffer.from(publicKey.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
if (buf.length !== 65) {
  console.error(`VAPID_PUBLIC_KEY decodes to ${buf.length} bytes (expected 65). Wrong key or truncated value.`);
  process.exit(1);
}

const subj = subject || "mailto:notifications@earnflow";
try {
  webpush.setVapidDetails(subj, publicKey, privateKey);
} catch (e) {
  console.error("web-push rejected this pair:", e?.message || e);
  console.error("Often the public and private keys are swapped, or one line is incomplete.");
  process.exit(1);
}

console.log("VAPID keys look valid (65-byte public key; web-push accepts the pair).");
if (!subject) {
  console.log("Tip: set VAPID_SUBJECT=mailto:you@yourdomain.com in .env for production.");
}
process.exit(0);
