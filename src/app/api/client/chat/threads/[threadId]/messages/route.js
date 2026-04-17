import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api";
import ClientChatThread from "@/models/ClientChatThread";
import { getSetting } from "@/models/Settings";

async function assertClientServicesEnabled() {
  const enabled = await getSetting("client_services_enabled", true);
  return Boolean(enabled);
}

export async function POST(request, { params }) {
  const auth = await requireAuth(["client"]);
  if (auth.error) return auth.error;
  await connectDB();
  if (!(await assertClientServicesEnabled())) return fail("Client services are currently disabled", 403);

  const threadId = String((await params).threadId || "");
  if (!threadId) return fail("threadId required");
  const body = await request.json().catch(() => ({}));
  const text = String(body.message || "").trim();
  if (!text) return fail("message required");

  const thread = await ClientChatThread.findOne({ _id: threadId, clientUserId: auth.payload.sub });
  if (!thread) return fail("Thread not found", 404);

  thread.messages.push({
    senderUserId: auth.payload.sub,
    senderRole: "client",
    body: text,
    sentAt: new Date(),
  });
  thread.status = "open";
  await thread.save();
  return ok({ message: "Message sent" });
}
