/**
 * Signup bonus "levels" are upline tiers: L1 = direct inviter, L2/L3 = the inviter’s sponsors (upstream).
 * This is not the same as affiliate-network "level 2" (referrals of your referrals), which is downline depth.
 */
export function buildCommissionPlan({ hierarchy, rules }) {
  const levels = [
    { level: 1, userId: hierarchy.uplineL1UserId },
    { level: 2, userId: hierarchy.uplineL2UserId },
    { level: 3, userId: hierarchy.uplineL3UserId },
  ];
  return levels
    .filter((item) => item.userId)
    .filter((item) => rules[`level${item.level}`]?.enabled)
    .map((item) => {
      const amount = Number(rules[`level${item.level}`].amount || 0);
      return {
        level: item.level,
        beneficiaryUserId: item.userId,
        amount: Number(amount.toFixed(2)),
      };
    })
    .filter((item) => item.amount > 0);
}
