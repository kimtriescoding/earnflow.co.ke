import { requireAuth } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { ok, fail } from "@/lib/api";
import { validateVapidKeyPairForWebPush } from "@/lib/notifications/vapid-validate";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return fail("Web push is not configured: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env", 503);
  }
  const check = validateVapidKeyPairForWebPush({
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  });
  if (!check.ok) {
    return fail(
      `${check.error} Regenerate with: pnpm run vapid:keys — then paste each key as a single line in .env and restart the server.`,
      503
    );
  }
  return ok({ data: { publicKey: env.VAPID_PUBLIC_KEY } });
}
