"use client";

import { AppShell } from "@/components/ui/AppShell";
import { userNavItems } from "@/lib/nav/user-nav";
import { filterUserNavItems } from "@/lib/modules/module-access";
import { useUserModuleAccess } from "@/components/user/UserModuleAccessProvider";
import { UserNotificationsBell } from "@/components/user/UserNotificationsBell";

export function UserAppShell(props) {
  const access = useUserModuleAccess();
  const navItems = filterUserNavItems(userNavItems, access);
  return <AppShell {...props} navItems={navItems} rightSlot={<UserNotificationsBell />} />;
}
