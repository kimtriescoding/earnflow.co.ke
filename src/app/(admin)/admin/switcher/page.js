import { notFound } from "next/navigation";
import { readAccessPayloadFromCookies } from "@/lib/auth/jwt";
import { isSuperadminRole } from "@/lib/auth/roles";
import SwitcherPageClient from "./SwitcherPageClient";

export default async function SuperadminSwitcherPage() {
  const payload = await readAccessPayloadFromCookies();
  if (!payload?.role || !isSuperadminRole(payload.role)) {
    notFound();
  }
  return <SwitcherPageClient />;
}
