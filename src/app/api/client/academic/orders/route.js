import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ModuleItem from "@/models/ModuleItem";
import ClientOrder from "@/models/ClientOrder";
import { getSetting, getZetupayCredentials } from "@/models/Settings";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { computeAcademicOrderPricing } from "@/lib/client-services/pricing";

async function assertClientServicesEnabled() {
  const enabled = await getSetting("client_services_enabled", true);
  return Boolean(enabled);
}

export async function GET() {
  const auth = await requireAuth(["client"]);
  if (auth.error) return auth.error;
  await connectDB();
  if (!(await assertClientServicesEnabled())) return fail("Client services are currently disabled", 403);

  const data = await ClientOrder.find({ clientUserId: auth.payload.sub, module: "academic" })
    .sort({ createdAt: -1 })
    .populate({ path: "moduleItemId", select: "title status approvalStatus metadata pricingSnapshot" })
    .lean();
  return ok({ data });
}

export async function POST(request) {
  const auth = await requireAuth(["client"]);
  if (auth.error) return auth.error;
  await connectDB();
  if (!(await assertClientServicesEnabled())) return fail("Client services are currently disabled", 403);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return fail("title required");

  const defaults = await getSetting("module_academic_default", {});
  const pricing = computeAcademicOrderPricing({
    wordCount: Number(body.wordCount || 0),
    basePrice: Number(defaults.clientBasePrice || 350),
    pricePer100Words: Number(defaults.clientPricePer100Words || 120),
    urgent: Boolean(body.urgent),
    urgentMultiplier: Number(defaults.urgentMultiplier || 1.5),
  });
  const assignmentReward = Number(defaults.baseReward || 20);

  const order = await ClientOrder.create({
    module: "academic",
    clientUserId: auth.payload.sub,
    title,
    description: String(body.description || "").trim(),
    wordCount: pricing.wordCount,
    itemReward: assignmentReward,
    unitPrice: pricing.unitPrice,
    subtotalAmount: pricing.subtotalAmount,
    totalAmount: pricing.totalAmount,
    status: "pending_payment",
    paymentStatus: "pending",
    metadata: {
      instructions: String(body.instructions || "").trim(),
      urgent: pricing.urgent,
      urgentMultiplier: pricing.urgentMultiplier,
    },
  });

  const moduleItem = await ModuleItem.create({
    module: "academic",
    title,
    description: String(body.description || "").trim(),
    reward: assignmentReward,
    thresholdSeconds: 0,
    status: "inactive",
    sourceType: "client",
    approvalStatus: "pending",
    clientOwnerId: auth.payload.sub,
    clientOrderId: order._id,
    pricingSnapshot: {
      unitPrice: pricing.unitPrice,
      totalAmount: pricing.totalAmount,
      currency: "KES",
      model: "per_100_words",
    },
    metadata: {
      instructions: String(body.instructions || "").trim(),
      wordCount: pricing.wordCount,
      urgent: pricing.urgent,
      orderId: order._id.toString(),
    },
    createdBy: auth.payload.sub,
  });

  order.moduleItemId = moduleItem._id;
  await order.save();

  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Payment credentials missing", 500);
  const reference = `CL-ACA-${Date.now()}`;
  const result = await initiateCheckout({
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    walletId: creds.walletId,
    amount: pricing.totalAmount,
    reference,
    redirectUrl: body.redirectUrl || `${process.env.APP_URL}/client/academic`,
    identifier: order._id.toString(),
    phoneNumber: String(body.phoneNumber || "").trim(),
  });
  if (!result.success) return fail(result.error || "Failed to initiate checkout", 400);

  order.paymentKey = result.paymentKey || "";
  order.checkoutUrl = result.checkoutUrl || "";
  order.paymentReference = reference;
  await order.save();

  return ok({ data: { orderId: order._id, checkoutUrl: result.checkoutUrl, paymentKey: result.paymentKey } }, 201);
}
