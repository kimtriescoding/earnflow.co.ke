import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { readAccessPayloadFromCookies } from "@/lib/auth/jwt";
import { getSetting } from "@/models/Settings";
import { UserModuleAccessProvider } from "@/components/user/UserModuleAccessProvider";
import { ROLE } from "@/lib/auth/roles";

export default async function UserLayout({ children }) {
  const payload = await readAccessPayloadFromCookies();
  if (!payload) redirect("/login");

  await connectDB();
  const user = await User.findById(payload.sub).select("role isActivated isBlocked").lean();
  if (!user) redirect("/login");
  if (user.isBlocked) redirect("/login");
  if ([ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN].includes(String(user.role || ""))) redirect("/admin");
  if (user.role === "client") redirect("/client");
  if (!user.isActivated) redirect("/activate");

  const moduleStatus = await getSetting("module_status", {});

  return <UserModuleAccessProvider value={moduleStatus}>{children}</UserModuleAccessProvider>;
}
