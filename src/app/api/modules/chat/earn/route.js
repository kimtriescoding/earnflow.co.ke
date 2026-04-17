import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import ModuleItem from "@/models/ModuleItem";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { ok, fail, guardRateLimit } from "@/lib/api";

export async function POST(request) {
  const limited = guardRateLimit(request, "chat.earn", 60, 60_000);
  if (limited) return limited;
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.chat === false) return fail("Chat module is currently disabled", 403);
  const defaults = await getSetting("module_chat_default", {});
  const mode = body.mode === "session" ? "session" : "message";
  if (mode === "message" && !body.message) return fail("message is required");
  const itemId = String(body.chatItemId || body.itemId || "").trim();
  const item =
    itemId && itemId.length > 10
      ? await ModuleItem.findOne({
          _id: itemId,
          module: "chat",
          status: "active",
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
        }).lean()
      : null;
  if (itemId && !item) return fail("Chat campaign unavailable", 404);
  const amount = Number(item?.reward || (mode === "session" ? defaults?.perSessionReward || 1.5 : defaults?.perMessageReward || 0.05));
  const event = await submitEarningEvent({
    userId: auth.payload.sub,
    amount,
    source: "chat",
    metadata: { mode, length: String(body.message || "").length, itemId: item?._id || null },
    status: "pending",
  });
  await logModuleInteraction({
    module: "chat",
    action: mode,
    status: "pending",
    amount,
    itemId: item?._id,
    userId: auth.payload.sub,
    earningEventId: event._id,
    metadata: { messageLength: String(body.message || "").length, campaignId: item?._id || null },
  });
  return ok({ data: event }, 201);
}
