"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { userNavItems } from "@/lib/nav/user-nav";
import { filterUserNavItems } from "@/lib/modules/module-access";
import { useUserModuleAccess } from "@/components/user/UserModuleAccessProvider";
import { UserNotificationsBell } from "@/components/user/UserNotificationsBell";

export function UserAppShell(props) {
  const access = useUserModuleAccess();
  const [showNotificationsBell, setShowNotificationsBell] = useState(false);
  const navItems = filterUserNavItems(userNavItems, access);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setShowNotificationsBell(true), { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => setShowNotificationsBell(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return <AppShell {...props} navItems={navItems} rightSlot={showNotificationsBell ? <UserNotificationsBell /> : null} />;
}
