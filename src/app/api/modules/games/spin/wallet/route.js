import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import LuckySpinWallet from "@/models/LuckySpinWallet";
import LuckySpinLedger from "@/models/LuckySpinLedger";
import LuckySpinTopup from "@/models/LuckySpinTopup";

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const [wallet, ledger, topups] = await Promise.all([
    LuckySpinWallet.findOneAndUpdate({ userId: auth.payload.sub }, { $setOnInsert: { userId: auth.payload.sub } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean(),
    LuckySpinLedger.find({ userId: auth.payload.sub }).sort({ createdAt: -1 }).limit(40).lean(),
    LuckySpinTopup.find({ userId: auth.payload.sub }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return ok({
    data: {
      wallet,
      ledger,
      topups,
    },
  });
}
