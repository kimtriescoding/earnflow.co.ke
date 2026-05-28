import connectDB from "@/lib/db";
import ActivationPayment from "@/models/ActivationPayment";
import Withdrawal from "@/models/Withdrawal";
import { requireAuth } from "@/lib/auth/guards";
import { ok } from "@/lib/api";
import { ADMIN_PAYMENTS_CACHE } from "@/lib/cache/get-cache-invalidation";

const firstNonEmpty = (fields, fallback) => ({
  $let: {
    vars: {
      candidates: fields.map((field) => ({ $ifNull: [field, ""] })),
    },
    in: {
      $ifNull: [
        {
          $first: {
            $filter: {
              input: "$$candidates",
              as: "candidate",
              cond: { $gt: [{ $strLenCP: { $toString: "$$candidate" } }, 0] },
            },
          },
        },
        fallback,
      ],
    },
  },
});

export async function GET(request) {
  const auth = await requireAuth(["admin", "support"]);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 20));

  const cacheKey = `${page}|${pageSize}`;
  const cached = ADMIN_PAYMENTS_CACHE.get(cacheKey);
  if (cached) return ok(cached);

  await connectDB();

  const [facet] = await ActivationPayment.aggregate([
    {
      $project: {
        kind: { $literal: "activation_checkout" },
        status: 1,
        amount: { $ifNull: ["$amount", 0] },
        reference: firstNonEmpty(["$reference", "$paymentKey"], "-"),
        userId: 1,
        createdAt: 1,
      },
    },
    {
      $unionWith: {
        coll: Withdrawal.collection.name,
        pipeline: [
          {
            $project: {
              kind: { $literal: "payout" },
              status: 1,
              amount: { $ifNull: ["$amount", 0] },
              reference: firstNonEmpty(["$transactionId"], "-"),
              userId: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        meta: [{ $count: "total" }],
        rows: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "_user",
            },
          },
          {
            $project: {
              kind: 1,
              status: 1,
              amount: 1,
              reference: 1,
              createdAt: 1,
              username: firstNonEmpty([{ $arrayElemAt: ["$_user.username", 0] }], "—"),
            },
          },
        ],
      },
    },
  ]);

  const total = Number(facet?.meta?.[0]?.total || 0);
  const data = (facet?.rows || []).map((row) => ({
    id: row._id.toString(),
    kind: row.kind,
    status: row.status,
    amount: Number(row.amount || 0),
    reference: String(row.reference || "-"),
    username: String(row.username || "—"),
    createdAt: row.createdAt,
  }));

  const result = { data, total, page, pageSize };
  ADMIN_PAYMENTS_CACHE.set(cacheKey, result);
  return ok(result);
}
