import Transaction from "@/models/Transaction";

/**
 * Records that the user paid the activation fee via checkout (M-Pesa / gateway).
 * Does not change in-app wallet or `User.balance` — that money never entered the app wallet, so deducting again would double-hit the user.
 * The row is for activity / statements only (money out vs off-platform payment).
 */
export async function recordActivationFeeDebit({ userId, paidAmount, activationPaymentId, reference }) {
  const paid = Number(paidAmount || 0);
  if (!Number.isFinite(paid) || paid <= 0) return;
  const apId = String(activationPaymentId || "");
  if (!apId) return;
  try {
    await Transaction.create({
      userId,
      type: "activation_fee",
      amount: -paid,
      description: "Account activation fee (paid via checkout)",
      status: "completed",
      metadata: {
        activationPaymentId: apId,
        reference: String(reference || ""),
        offPlatformPayment: true,
      },
    });
  } catch (e) {
    if (e?.code === 11000) return;
    throw e;
  }
}
