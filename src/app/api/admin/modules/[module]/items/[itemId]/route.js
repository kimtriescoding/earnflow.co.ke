import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ModuleItem from "@/models/ModuleItem";
import { isSupportedModule, normalizeModuleKey, toModuleType } from "@/lib/modules/constants";

export async function PATCH(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const { module, itemId } = await params;
  const slug = normalizeModuleKey(module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);
  if (!itemId) return fail("itemId required");

  await connectDB();
  const body = await request.json().catch(() => ({}));
  const updates = {};
  if (body.title !== undefined) updates.title = String(body.title || "").trim();
  if (body.description !== undefined) updates.description = String(body.description || "").trim();
  if (body.reward !== undefined) updates.reward = Number(body.reward || 0);
  if (body.thresholdSeconds !== undefined) updates.thresholdSeconds = Number(body.thresholdSeconds || 0);
  if (body.status !== undefined) updates.status = body.status === "inactive" ? "inactive" : "active";
  if (body.approvalStatus !== undefined) updates.approvalStatus = body.approvalStatus === "rejected" ? "rejected" : body.approvalStatus === "pending" ? "pending" : "approved";
  if (body.targetViews !== undefined) updates.targetViews = Number(body.targetViews || 0);
  if (body.pricingSnapshot !== undefined)
    updates.pricingSnapshot = body.pricingSnapshot && typeof body.pricingSnapshot === "object" ? body.pricingSnapshot : null;
  if (body.metadata !== undefined) updates.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  const row = await ModuleItem.findOneAndUpdate({ _id: itemId, module: toModuleType(slug) }, updates, { new: true }).lean();
  if (!row) return fail("Item not found", 404);
  return ok({ data: row });
}

export async function DELETE(_request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const { module, itemId } = await params;
  const slug = normalizeModuleKey(module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);
  if (!itemId) return fail("itemId required");

  await connectDB();
  const row = await ModuleItem.findOneAndDelete({ _id: itemId, module: toModuleType(slug) }).lean();
  if (!row) return fail("Item not found", 404);
  return ok({ message: "Item deleted" });
}
