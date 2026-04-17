import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ClientOrder from "@/models/ClientOrder";
import ModuleItem from "@/models/ModuleItem";
import { normalizeModuleKey, toModuleType } from "@/lib/modules/constants";

const CLIENT_MODULES = new Set(["video", "chat", "academic"]);

export async function GET(request, { params }) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!CLIENT_MODULES.has(slug)) return fail("Unsupported client submissions module", 404);
  await connectDB();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const status = String(searchParams.get("status") || "pending_approval").trim();
  const filter = { module: slug };
  if (status) filter.status = status;

  const [total, data] = await Promise.all([
    ClientOrder.countDocuments(filter),
    ClientOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: "clientUserId", select: "username email" })
      .populate({ path: "moduleItemId", select: "title status approvalStatus sourceType targetViews" })
      .lean(),
  ]);

  return ok({ data, total, page, pageSize });
}

export async function POST(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!CLIENT_MODULES.has(slug)) return fail("Unsupported client submissions module", 404);
  await connectDB();

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  const decision = String(body.decision || "").trim().toLowerCase();
  if (!orderId) return fail("orderId required");
  if (!["approve", "reject"].includes(decision)) return fail("decision must be approve or reject");

  const order = await ClientOrder.findOne({ _id: orderId, module: slug });
  if (!order) return fail("Submission not found", 404);
  if (!["pending_approval", "paid"].includes(order.status)) return fail("Submission is not in reviewable state", 400);

  const now = new Date();
  const patch =
    decision === "approve"
      ? {
          status: "approved",
          approvedBy: auth.payload.sub,
          approvedAt: now,
          rejectionReason: "",
        }
      : {
          status: "rejected",
          approvedBy: auth.payload.sub,
          approvedAt: now,
          rejectionReason: String(body.rejectionReason || "Rejected by admin").trim(),
        };

  Object.assign(order, patch);
  await order.save();

  if (order.moduleItemId) {
    await ModuleItem.findOneAndUpdate(
      { _id: order.moduleItemId, module: toModuleType(slug) },
      {
        approvalStatus: decision === "approve" ? "approved" : "rejected",
        status: decision === "approve" ? "active" : "inactive",
        approvedBy: auth.payload.sub,
        approvedAt: now,
      }
    );
  }

  return ok({ message: decision === "approve" ? "Submission approved" : "Submission rejected" });
}
