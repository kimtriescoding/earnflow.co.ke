import { redirect } from "next/navigation";
import { getCachedSetting } from "@/lib/settings/cached-settings";
import { isModuleEnabled } from "@/lib/modules/module-access";

/**
 * Server-only: redirect to `/dashboard` if the earning module is turned off in admin.
 * @param {"video" | "task" | "game" | "academic" | "chat" | "lucky_spin" | "aviator"} moduleKey — `game` is deprecated; use `lucky_spin` / `aviator`.
 */
export async function assertUserModuleEnabled(moduleKey) {
  const raw = await getCachedSetting("module_status", {});
  if (!isModuleEnabled(raw, moduleKey)) {
    redirect("/dashboard");
  }
}
