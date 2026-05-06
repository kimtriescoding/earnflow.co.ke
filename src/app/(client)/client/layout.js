import { redirect } from "next/navigation";
import { readAccessPayloadFromCookies } from "@/lib/auth/jwt";
import { ROLE } from "@/lib/auth/roles";
import { getCachedSessionUserState } from "@/lib/auth/session-state";
import { getCachedSetting } from "@/lib/settings/cached-settings";

export default async function ClientLayout({ children }) {
  const payload = await readAccessPayloadFromCookies();
  if (!payload) redirect("/login");

  const user = await getCachedSessionUserState(payload.sub);
  if (!user) redirect("/login");
  if (user.isBlocked) redirect("/login");
  if ([ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(user.role || ""))) redirect("/admin");
  if (user.role !== "client") redirect("/dashboard");

  const enabled = await getCachedSetting("client_services_enabled", true);
  if (!enabled) redirect("/login");

  return children;
}
