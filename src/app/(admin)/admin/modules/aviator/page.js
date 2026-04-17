"use client";

import { AppShell } from "@/components/ui/AppShell";
import { ModuleOperationsConsole } from "@/components/admin/ModuleOperationsConsole";
import { adminNavItems } from "@/lib/nav/admin-nav";

export default function AdminAviatorPage() {
  return (
    <AppShell title="Aviator Configuration" navItems={adminNavItems}>
      <ModuleOperationsConsole
        moduleSlug="aviator"
        heading="Aviator economics"
        description="Configure hidden win probability, minimum bet amount, and max burst. Win probability remains server-side and is never exposed to players."
        configFields={[
          { key: "winProbability", label: "Hidden win probability % (0-95)", type: "number" },
          { key: "minBetAmount", label: "Minimum bet amount (KES)", type: "number" },
          { key: "maxBurst", label: "Max burst multiplier (2-100x)", type: "number" },
        ]}
        enableCrud={false}
        interactionColumns={[
          {
            field: "userId",
            header: "User",
            sortable: false,
            render: (row) => row.userId?.username || row.userId?.email || "-",
          },
          {
            field: "betAmount",
            header: "Bet (KES)",
            sortable: false,
            render: (row) => Number(row.metadata?.betAmount || 0).toFixed(2),
          },
          {
            field: "cashoutAt",
            header: "Cashout Target",
            sortable: false,
            render: (row) => `${Number(row.metadata?.cashoutAt || 0).toFixed(2)}x`,
          },
          {
            field: "bustAt",
            header: "Burst At",
            sortable: false,
            render: (row) => `${Number(row.metadata?.bustAt || 0).toFixed(2)}x`,
          },
          {
            field: "result",
            header: "Outcome",
            sortable: false,
            render: (row) => (row.status === "approved" ? "Win" : "Loss"),
          },
          {
            field: "payout",
            header: "Payout (KES)",
            sortable: false,
            render: (row) => Number(row.amount || 0).toFixed(2),
          },
          {
            field: "createdAt",
            header: "Date",
            sortable: false,
            render: (row) => new Date(row.createdAt).toLocaleString(),
          },
        ]}
      />
    </AppShell>
  );
}
