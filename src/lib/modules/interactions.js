import connectDB from "@/lib/db";
import ModuleInteraction from "@/models/ModuleInteraction";
import { toModuleType } from "./constants";

export async function logModuleInteraction({
  module,
  action,
  status = "pending",
  amount = 0,
  itemId = null,
  userId = null,
  earningEventId = null,
  metadata = {},
}) {
  await connectDB();
  return ModuleInteraction.create({
    module: toModuleType(module),
    action,
    status,
    amount: Number(amount || 0),
    itemId: itemId || null,
    userId: userId || null,
    earningEventId: earningEventId || null,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });
}
