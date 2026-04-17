import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ClientOrder from "@/models/ClientOrder";
import { getSetting } from "@/models/Settings";

async function assertClientServicesEnabled() {
  const enabled = await getSetting("client_services_enabled", true);
  return Boolean(enabled);
}

export async function GET() {
  const auth = await requireAuth(["client"]);
  if (auth.error) return auth.error;
  await connectDB();
  if (!(await assertClientServicesEnabled())) return fail("Client services are currently disabled", 403);

  const filter = { clientUserId: auth.payload.sub };
  const [totalOrders, pendingApproval, approvedCampaigns, paidOrders, spendAgg] = await Promise.all([
    ClientOrder.countDocuments(filter),
    ClientOrder.countDocuments({ ...filter, status: "pending_approval" }),
    ClientOrder.countDocuments({ ...filter, status: { $in: ["approved", "in_progress", "completed"] } }),
    ClientOrder.countDocuments({ ...filter, paymentStatus: "success" }),
    ClientOrder.aggregate([
      { $match: filter },
      { $group: { _id: null, totalSpend: { $sum: "$totalAmount" } } },
    ]),
  ]);
  return ok({
    data: {
      totalOrders,
      pendingApproval,
      approvedCampaigns,
      paidOrders,
      totalSpend: Number(spendAgg[0]?.totalSpend || 0),
    },
  });
}
