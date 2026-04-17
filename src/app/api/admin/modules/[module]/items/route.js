import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ModuleItem from "@/models/ModuleItem";
import { isSupportedModule, normalizeModuleKey, toModuleType } from "@/lib/modules/constants";

export async function GET(request, { params }) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const search = String(searchParams.get("search") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const filter = { module: toModuleType(slug) };
  if (status) filter.status = status;
  if (search) filter.title = { $regex: search, $options: "i" };

  const [total, rows] = await Promise.all([
    ModuleItem.countDocuments(filter),
    ModuleItem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ]);
  return ok({ data: rows, total, page, pageSize });
}

export async function POST(request, { params }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const slug = normalizeModuleKey((await params).module);
  if (!isSupportedModule(slug)) return fail("Unsupported module", 404);

  await connectDB();
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return fail("title required");

  const item = await ModuleItem.create({
    module: toModuleType(slug),
    title,
    description: String(body.description || "").trim(),
    reward: Number(body.reward || 0),
    thresholdSeconds: Number(body.thresholdSeconds || 0),
    status: body.status === "inactive" ? "inactive" : "active",
    sourceType: "admin",
    approvalStatus: "approved",
    approvedBy: auth.payload.sub,
    approvedAt: new Date(),
    targetViews: Number(body.targetViews || 0),
    pricingSnapshot: body.pricingSnapshot && typeof body.pricingSnapshot === "object" ? body.pricingSnapshot : null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    createdBy: auth.payload.sub,
  });
  return ok({ data: item }, 201);
}
