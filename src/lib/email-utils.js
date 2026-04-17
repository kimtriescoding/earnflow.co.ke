import { logInfo, logError } from "./observability/logger";
import { getEnv } from "./env";
import { Resend } from "resend";

let cachedResend = null;

function getResendClient() {
  if (cachedResend) return cachedResend;
  const env = getEnv();
  if (!env.RESEND_API_KEY) return null;
  cachedResend = new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

export async function sendMfaSetupOtpEmail({ to, username, otp }) {
  const env = getEnv();
  const resend = getResendClient();
  if (!resend || !env.EMAIL_FROM) {
    logInfo("email.mfa.bootstrap_otp.skipped", { to, username, otp, reason: "resend_not_configured" });
    return { sent: false, reason: "resend_not_configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [to],
      subject: "Earnflow Agencies security code",
      text: `Hi ${username || "there"}, your Earnflow Agencies security code is ${otp}. It expires in 5 minutes.`,
      html: `<p>Hi ${username || "there"},</p><p>Your Earnflow Agencies security code is <strong style="font-size:20px;letter-spacing:2px;">${otp}</strong>.</p><p>This code expires in 5 minutes.</p>`,
    });
    if (error) {
      logError("email.mfa.bootstrap_otp.resend_error", { to, message: error.message });
      return { sent: false, reason: "resend_api_error" };
    }
    logInfo("email.mfa.bootstrap_otp.sent", { to, id: data?.id });
    return { sent: true };
  } catch (err) {
    logError("email.mfa.bootstrap_otp.failed", { to, error: err?.message || "unknown" });
    return { sent: false, reason: "resend_exception" };
  }
}

export async function sendWithdrawalSuccessEmail(payload) {
  logInfo("email.withdrawal.success", payload);
}

export async function sendWithdrawalFailedEmail(payload) {
  logInfo("email.withdrawal.failed", payload);
}
