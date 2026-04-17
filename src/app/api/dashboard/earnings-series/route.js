import connectDB from "@/lib/db";
import EarningEvent from "@/models/EarningEvent";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();

  const from = startOfDay(new Date(Date.now() - 1000 * 60 * 60 * 24 * 13));
  const events = await EarningEvent.find({
    userId: auth.payload.sub,
    status: "approved",
    createdAt: { $gte: from },
  })
    .select("amount source createdAt")
    .lean();

  const dayMap = new Map();
  for (let i = 0; i < 14; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }
  const sourceMap = new Map();

  for (const ev of events) {
    const key = new Date(ev.createdAt).toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) || 0) + Number(ev.amount || 0));
    sourceMap.set(ev.source, (sourceMap.get(ev.source) || 0) + Number(ev.amount || 0));
  }

  const series = Array.from(dayMap.entries()).map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));
  const breakdown = Array.from(sourceMap.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  return ok({ data: { series, breakdown } });
}
