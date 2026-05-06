import { redirect } from "next/navigation";
import { readAccessPayloadFromCookies } from "@/lib/auth/jwt";
import { UserModuleAccessProvider } from "@/components/user/UserModuleAccessProvider";
import { ROLE } from "@/lib/auth/roles";
import { getCachedSessionUserState } from "@/lib/auth/session-state";
import { getCachedSetting } from "@/lib/settings/cached-settings";

export default async function UserLayout({ children }) {
  const payload = await readAccessPayloadFromCookies();
  if (!payload) redirect("/login");

  const user = await getCachedSessionUserState(payload.sub);
  if (!user) redirect("/login");
  if (user.isBlocked) redirect("/login");
  if ([ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(user.role || ""))) redirect("/admin");
  if (user.role === "client") redirect("/client");
  if (!user.isActivated) redirect("/activate");

  const moduleStatus = await getCachedSetting("module_status", {});

  return <UserModuleAccessProvider value={moduleStatus}>{children}</UserModuleAccessProvider>;
}
