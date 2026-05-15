import mongoose from "mongoose";
import ModuleInteraction from "@/models/ModuleInteraction";
import { BLOCKING_SUBMISSION_STATUSES } from "@/lib/modules/academic";

/**
 * @param {string} module
 * @param {string} action
 * @param {import("mongoose").Types.ObjectId[] | string[]} itemIds
 * @returns {Promise<Map<string, number>>}
 */
export async function countDistinctParticipantsByItemIds(module, action, itemIds) {
  const ids = (itemIds || [])
    .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : null))
    .filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await ModuleInteraction.aggregate([
    {
      $match: {
        module,
        action,
        itemId: { $in: ids },
        status: { $in: BLOCKING_SUBMISSION_STATUSES },
      },
    },
    { $group: { _id: "$itemId", users: { $addToSet: "$userId" } } },
    { $project: { filled: { $size: "$users" } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), Number(row.filled || 0)]));
}
