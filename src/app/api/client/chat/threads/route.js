import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ModuleItem from "@/models/ModuleItem";
import ClientOrder from "@/models/ClientOrder";
import ClientChatThread from "@/models/ClientChatThread";
import { getSetting, getZetupayCredentials } from "@/models/Settings";
import { initiateCheckout } from "@/lib/payments/wavepay";
import { computeChatOrderPricing } from "@/lib/client-services/pricing";

async function assertClientServicesEnabled() {
  const enabled = await getSetting("client_services_enabled", true);
  return Boolean(enabled);
}

export async function GET() {
  const auth = await requireAuth(["client"]);
  if (auth.error) return auth.error;
  await connectDB();
  if (!(await assertClientServicesEnabled())) return fail("Client services are currently disabled", 403);

  const data = await ClientChatThread.find({ clientUserId: auth.payload.sub })
    .sort({ updatedAt: -1 })
    .populate({ path: "orderId", select: "status paymentStatus totalAmount requestedMinutes title" })
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
  const topic = String(body.topic || "").trim();

  const defaults = await getSetting("module_chat_default", {});
  const pricing = computeChatOrderPricing({
    requestedMinutes: Number(body.requestedMinutes || 0),
    pricePerMinute: Number(defaults.clientPricePerMinute || 2),
    setupFee: Number(defaults.clientSessionSetupFee || 50),
  });
  const reward = Number(defaults.perSessionReward || 1.5);

  const order = await ClientOrder.create({
    module: "chat",
    clientUserId: auth.payload.sub,
    title,
    description: topic,
    requestedMinutes: pricing.requestedMinutes,
    itemReward: reward,
    unitPrice: pricing.unitPrice,
    subtotalAmount: pricing.subtotalAmount,
    totalAmount: pricing.totalAmount,
    status: "pending_payment",
    paymentStatus: "pending",
    metadata: {
      topic,
      setupFee: pricing.setupFee,
      asyncThread: true,
    },
  });

  const thread = await ClientChatThread.create({
    clientUserId: auth.payload.sub,
    orderId: order._id,
    title,
    topic,
    participantIds: [auth.payload.sub],
    status: "pending",
    metadata: {
      requestedMinutes: pricing.requestedMinutes,
    },
  });

  const moduleItem = await ModuleItem.create({
    module: "chat",
    title,
    description: topic,
    reward,
    thresholdSeconds: 0,
    status: "inactive",
    sourceType: "client",
    approvalStatus: "pending",
    clientOwnerId: auth.payload.sub,
    clientOrderId: order._id,
    pricingSnapshot: {
      unitPrice: pricing.unitPrice,
      setupFee: pricing.setupFee,
      totalAmount: pricing.totalAmount,
      currency: "KES",
      model: "per_minute",
    },
    metadata: {
      threadId: thread._id.toString(),
      requestedMinutes: pricing.requestedMinutes,
      orderId: order._id.toString(),
    },
    createdBy: auth.payload.sub,
  });

  order.moduleItemId = moduleItem._id;
  await order.save();

  const creds = await getZetupayCredentials(false);
  if (creds?.error) return fail("Payment credentials missing", 500);
  const reference = `CL-CHAT-${Date.now()}`;
  const result = await initiateCheckout({
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    walletId: creds.walletId,
    amount: pricing.totalAmount,
    reference,
    redirectUrl: body.redirectUrl || `${process.env.APP_URL}/client/chat`,
    identifier: order._id.toString(),
    phoneNumber: String(body.phoneNumber || "").trim(),
  });
  if (!result.success) return fail(result.error || "Failed to initiate checkout", 400);

  order.paymentKey = result.paymentKey || "";
  order.checkoutUrl = result.checkoutUrl || "";
  order.paymentReference = reference;
  await order.save();

  return ok({ data: { threadId: thread._id, orderId: order._id, checkoutUrl: result.checkoutUrl, paymentKey: result.paymentKey } }, 201);
}
