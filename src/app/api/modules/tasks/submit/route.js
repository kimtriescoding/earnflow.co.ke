import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth/guards";
import connectDB from "@/lib/db";
import ModuleItem from "@/models/ModuleItem";
import { getSetting } from "@/models/Settings";
import { submitEarningEvent } from "@/lib/ledger/earnings";
import { logModuleInteraction } from "@/lib/modules/interactions";
import { ok, fail } from "@/lib/api";

export async function POST(request) {
  const auth = await requireAuth(["user", "admin"]);
  if (auth.error) return auth.error;
  await connectDB();
  const body = await request.json().catch(() => ({}));
  const taskId = String(body.taskId || "");
  if (!taskId) return fail("taskId required");
  const moduleStatus = await getSetting("module_status", {});
  if (moduleStatus?.task === false) return fail("Task module is currently disabled", 403);
  const defaults = await getSetting("module_task_default", {});
  const lookup = mongoose.Types.ObjectId.isValid(taskId) ? { _id: taskId } : { "metadata.taskId": taskId };
  const item = await ModuleItem.findOne({ ...lookup, module: "task", status: "active" }).lean();
  const validationMode = body.validationMode === "auto" ? "auto" : "manual";
  const reward = Number(body.reward || item?.reward || defaults?.reward || 5);
  const event = await submitEarningEvent({
    userId: auth.payload.sub,
    amount: reward,
    source: "task",
    metadata: { taskId, evidence: body.evidence, validationMode, itemId: item?._id || null },
    status: validationMode === "auto" ? "approved" : "pending",
  });
  await logModuleInteraction({
    module: "task",
    action: "submit",
    status: validationMode === "auto" ? "approved" : "pending",
    amount: reward,
    itemId: item?._id,
    userId: auth.payload.sub,
    earningEventId: event._id,
    metadata: { taskId, validationMode },
  });
  return ok({ data: event }, 201);
}
