"use client";

import { AppShell } from "@/components/ui/AppShell";
import { ModuleOperationsConsole } from "@/components/admin/ModuleOperationsConsole";
import { adminNavItems } from "@/lib/nav/admin-nav";

export default function AdminLuckySpinPage() {
  return (
    <AppShell title="Lucky Spin Configuration" navItems={adminNavItems}>
      <ModuleOperationsConsole
        moduleSlug="lucky-spin"
        heading="Lucky spin economics"
        description="Configure hidden win probability, visible wheel segments, and minimum bet. Probability is server-side and never exposed to players."
        configFields={[
          { key: "segmentCount", label: "Wheel segment count (2-12)", type: "number" },
          { key: "winProbability", label: "Hidden win probability % (1-95)", type: "number" },
          { key: "minBetAmount", label: "Minimum bet amount (KES)", type: "number" },
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
            field: "result",
            header: "Outcome",
            sortable: false,
            render: (row) => (row.metadata?.result === "win" ? "Win" : "Loss"),
          },
          {
            field: "multiplier",
            header: "Multiplier",
            sortable: false,
            render: (row) => `${Number(row.metadata?.multiplier || 0)}x`,
          },
          {
            field: "payout",
            header: "Payout (KES)",
            sortable: false,
            render: (row) => {
              const payout = row.metadata?.payout ?? row.amount ?? 0;
              return Number(payout).toFixed(2);
            },
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
