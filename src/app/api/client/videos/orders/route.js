import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ModuleItem from "@/models/ModuleItem";
import ClientOrder from "@/models/ClientOrder";
import { getSetting, getZetupayCredentials } from "@/models/Settings";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { computeVideoOrderPricing } from "@/lib/client-services/pricing";

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

async function assertClientServicesEnabled() {
  const enabled = await getSetting("client_services_enabled", true);
  return Boolean(enabled);
}

export async function GET() {
  const auth = await requireAuth(["client"]);
  if (auth.error) return auth.error;
  await connectDB();
  if (!(await assertClientServicesEnabled())) return fail("Client services are currently disabled", 403);

  const data = await ClientOrder.find({ clientUserId: auth.payload.sub, module: "video" })
    .sort({ createdAt: -1 })
    .populate({ path: "moduleItemId", select: "title status approvalStatus targetViews metadata" })
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
  const videoUrl = normalizeUrl(body.videoUrl);
  if (!videoUrl) return fail("videoUrl required");

  const defaults = await getSetting("module_video_default", {});
  const pricing = computeVideoOrderPricing({
    targetViews: Number(body.targetViews || 0),
    pricePerView: Number(defaults.clientPricePerView || 0.25),
    minimumViews: Number(defaults.minTargetViews || 200),
  });
  const clientReward = Number(defaults.reward || 2);

  const order = await ClientOrder.create({
    module: "video",
    clientUserId: auth.payload.sub,
    title,
    description: String(body.description || "").trim(),
    targetViews: pricing.targetViews,
    itemReward: clientReward,
    unitPrice: pricing.unitPrice,
    subtotalAmount: pricing.subtotalAmount,
    totalAmount: pricing.totalAmount,
    status: "pending_payment",
    paymentStatus: "pending",
    metadata: { videoUrl },
  });

  const moduleItem = await ModuleItem.create({
    module: "video",
    title,
    description: String(body.description || "").trim(),
    reward: clientReward,
    thresholdSeconds: Number(defaults.thresholdSeconds || 30),
    status: "inactive",
    sourceType: "client",
    approvalStatus: "pending",
    clientOwnerId: auth.payload.sub,
    clientOrderId: order._id,
    targetViews: pricing.targetViews,
    pricingSnapshot: {
      unitPrice: pricing.unitPrice,
      totalAmount: pricing.totalAmount,
      currency: "KES",
      model: "target_views",
    },
    metadata: { videoUrl, videoId: order._id.toString() },
    createdBy: auth.payload.sub,
  });

  order.moduleItemId = moduleItem._id;
  await order.save();

  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Payment credentials missing", 500);
  const reference = `CL-VID-${Date.now()}`;
  const result = await initiateCheckout({
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    walletId: creds.walletId,
    amount: pricing.totalAmount,
    reference,
    redirectUrl: body.redirectUrl || `${process.env.APP_URL}/client/videos`,
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
