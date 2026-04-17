"use client";

import { AppShell } from "@/components/ui/AppShell";
import { ModuleOperationsConsole } from "@/components/admin/ModuleOperationsConsole";
import { adminNavItems } from "@/lib/nav/admin-nav";

const academicItemFields = [
  {
    key: "startsAt",
    label: "Time to start",
    columnHeader: "Opens",
    type: "datetime-local",
    target: "metadata",
    placeholder: "Leave empty = writers can start immediately",
  },
  {
    key: "deadline",
    label: "Deadline",
    columnHeader: "Due",
    type: "datetime-local",
    target: "metadata",
    placeholder: "Leave empty = no closing date",
  },
  {
    key: "minWords",
    label: "Min words",
    columnHeader: "Words",
    type: "integer",
    target: "metadata",
    placeholder: "e.g. 500 (use 0 if no minimum)",
  },
  {
    key: "format",
    label: "Format (e.g. APA, MLA, PDF)",
    columnHeader: "Format",
    type: "text",
    target: "metadata",
    placeholder: "e.g. APA 7th edition, Times 12pt, PDF export",
  },
  {
    key: "maxParticipants",
    label: "Max users (0 = unlimited)",
    columnHeader: "Cap",
    type: "integer",
    target: "metadata",
    placeholder: "e.g. 5 writers, or 0 for unlimited",
  },
];

export default function AdminAcademicModulePage() {
  return (
    <AppShell title="Academic Writing" navItems={adminNavItems}>
      <ModuleOperationsConsole
        moduleSlug="academic"
        heading="Academic tasks & writer workflow"
        description="Create tasks with per-assignment reward, schedule, requirements, and capacity. Writer rewards are set on each task — not from a global base reward. Client order pricing below applies only when clients place paid academic orders."
        configFields={[
          {
            key: "clientBasePrice",
            label: "Client base order price (KES)",
            type: "number",
            placeholder: "e.g. 350 — flat fee before word-based pricing",
          },
          {
            key: "clientPricePer100Words",
            label: "Client price per 100 words (KES)",
            type: "number",
            placeholder: "e.g. 120 — added on top of base for each 100 words",
          },
          {
            key: "urgentMultiplier",
            label: "Urgent multiplier",
            type: "number",
            placeholder: "e.g. 1.5 — client pays this × normal price when urgent",
          },
        ]}
        defaultItemReward={20}
        itemPlaceholder="e.g. H2 essay — renewable energy policy (min 1200 words)"
        itemDescriptionPlaceholder="Brief for writers: topic focus, required sections, sources, file naming, and anything else they must follow."
        itemRewardPlaceholder="Writer payout in KES when the submission is approved"
        itemLabel="task"
        itemFields={academicItemFields}
        showThresholdSeconds={false}
        descriptionMultiline
        collapseScheduleInTable
        itemTableShowBrief={false}
        itemTableOmitKeys={["format"]}
      />
    </AppShell>
  );
}
