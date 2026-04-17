import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { getSetting } from "@/models/Settings";
import { isModuleEnabled } from "@/lib/modules/module-access";

/**
 * Server-only: redirect to `/dashboard` if the earning module is turned off in admin.
 * @param {"video" | "task" | "game" | "academic" | "chat"} moduleKey
 */
export async function assertUserModuleEnabled(moduleKey) {
  await connectDB();
  const raw = await getSetting("module_status", {});
  if (!isModuleEnabled(raw, moduleKey)) {
    redirect("/dashboard");
  }
}
