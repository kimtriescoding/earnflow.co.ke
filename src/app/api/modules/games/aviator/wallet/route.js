import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import { getSetting } from "@/models/Settings";
import { isModuleEnabled } from "@/lib/modules/module-access";
import AviatorLedger from "@/models/AviatorLedger";
import AviatorTopup from "@/models/AviatorTopup";
import { getOrCreateAviatorWallet } from "@/lib/aviator/wallet";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const moduleStatus = await getSetting("module_status", {});
  if (!isModuleEnabled(moduleStatus, "aviator")) return fail("Aviator is disabled", 403);

  const [wallet, ledger, topups] = await Promise.all([
    getOrCreateAviatorWallet(auth.payload.sub),
    AviatorLedger.find({ userId: auth.payload.sub }).sort({ createdAt: -1 }).limit(40).lean(),
    AviatorTopup.find({ userId: auth.payload.sub }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return ok({
    data: {
      wallet,
      ledger,
      topups,
    },
  });
}
