import { z } from "zod";
import { normalizeVapidKey } from "@/lib/notifications/vapid-env";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  WAVEPAY_API_BASE_URL: z.string().url(),
  WAVEPAY_PAYOUT_API_BASE_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ACTIVATION_FEE_KSH: z.coerce.number().positive().default(200),
  ACTIVATION_FEE_ALLOW_ADMIN_OVERRIDE: z.enum(["true", "false"]).default("false"),
  WAVEPAY_CALLBACK_SECRET: z.string().min(12).optional(),
  /**
   * INSECURE: accept ZetuPay callbacks without `x-zetupay-secret` when no private key / env secret is set.
   * Only for local smoke tests — never enable in production.
   */
  WAVEPAY_ALLOW_INSECURE_CALLBACKS: z.enum(["true", "false"]).default("false"),
  /** Optional: `Authorization: Bearer <secret>` for `/api/cron/outbox` */
  CRON_SECRET: z.string().min(16).optional(),
  ADMIN_TOTP_ISSUER: z.string().default("Earnflow"),
  /** Speakeasy TOTP `window` (±steps × 30s). Match needs |clock skew| ≤ window; e.g. 24 ≈ ±12 min. */
  TOTP_VERIFY_WINDOW: z.coerce.number().int().min(1).max(120).default(24),
  ADMIN_MFA_REAUTH_WINDOW_SEC: z.coerce.number().int().positive().default(300),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().email().optional()
  ),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Web Push (VAPID). Generate: `pnpm exec web-push generate-vapid-keys` */
  VAPID_PUBLIC_KEY: z.preprocess((v) => normalizeVapidKey(v), z.string().min(1).optional()),
  VAPID_PRIVATE_KEY: z.preprocess((v) => normalizeVapidKey(v), z.string().min(1).optional()),
  /** e.g. mailto:you@domain.com or https://your-domain.com */
  VAPID_SUBJECT: z.preprocess((v) => normalizeVapidKey(v), z.string().min(1).optional()),
});

let parsed;
export function getEnv() {
  if (!parsed) {
    parsed = envSchema.parse(process.env);
  }
  return parsed;
}
