import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { getSetting } from "@/models/Settings";
import { readAccessPayloadFromCookies } from "@/lib/auth/jwt";

export default async function ClientLayout({ children }) {
  const payload = await readAccessPayloadFromCookies();
  if (!payload) redirect("/login");

  await connectDB();
  const user = await User.findById(payload.sub).select("role isBlocked").lean();
  if (!user) redirect("/login");
  if (user.isBlocked) redirect("/login");
  if (user.role === "admin" || user.role === "support") redirect("/admin");
  if (user.role !== "client") redirect("/dashboard");

  const enabled = await getSetting("client_services_enabled", true);
  if (!enabled) redirect("/login");

  return children;
}
