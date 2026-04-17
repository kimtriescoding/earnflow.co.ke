"use client";

import { createContext, useContext, useMemo } from "react";
import { normalizeModuleAccess } from "@/lib/modules/module-access";

const UserModuleAccessContext = createContext(null);

export function UserModuleAccessProvider({ value, children }) {
  const normalized = useMemo(() => normalizeModuleAccess(value || {}), [value]);
  return <UserModuleAccessContext.Provider value={normalized}>{children}</UserModuleAccessContext.Provider>;
}

export function useUserModuleAccess() {
  const ctx = useContext(UserModuleAccessContext);
  if (!ctx) return normalizeModuleAccess({});
  return ctx;
}
