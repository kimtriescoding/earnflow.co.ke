"use client";

import { AppShell } from "@/components/ui/AppShell";
import { ModuleOperationsConsole } from "@/components/admin/ModuleOperationsConsole";
import { adminNavItems } from "@/lib/nav/admin-nav";

const videoItemFields = [
  {
    key: "videoUrl",
    label: "Video URL",
    columnHeader: "Video",
    type: "url",
    target: "metadata",
    placeholder: "YouTube, Vimeo, or direct .mp4 link users will watch",
  },
  {
    key: "startsAt",
    label: "Available from",
    columnHeader: "Opens",
    type: "datetime-local",
    target: "metadata",
    placeholder: "Leave empty to publish immediately",
  },
  {
    key: "deadline",
    label: "Available until",
    columnHeader: "Until",
    type: "datetime-local",
    target: "metadata",
    placeholder: "Leave empty for no end date",
  },
  {
    key: "maxParticipants",
    label: "Max viewers (0 = unlimited)",
    columnHeader: "Cap",
    type: "integer",
    target: "metadata",
    placeholder: "e.g. 500 unique earners, or 0 for unlimited",
  },
  {
    key: "targetViews",
    label: "Target views (campaign / reporting)",
    columnHeader: "Target",
    type: "integer",
    target: "root",
    placeholder: "Optional goal number of completed views (0 = not set)",
  },
  {
    key: "rewardWithdrawable",
    label: "Reward is withdrawable",
    columnHeader: "Withdraw",
    type: "checkbox",
    target: "root",
    defaultChecked: true,
    help: "If unchecked, approved rewards count toward video stats and lifetime earnings but do not increase the balance users can cash out.",
  },
];

export default function AdminVideosModulePage() {
  return (
    <AppShell title="Videos" navItems={adminNavItems}>
      <ModuleOperationsConsole
        moduleSlug="video"
        heading="Video tasks & watch-to-earn"
        description="Each video has its own reward, watch-time threshold, link, optional schedule, and viewer cap. Defaults below apply to client-paid video campaigns only — not per-user watch rewards."
        configFields={[
          {
            key: "clientPricePerView",
            label: "Client price per completed view (KES)",
            type: "number",
            placeholder: "e.g. 0.25 — billed to clients per qualifying view",
          },
          {
            key: "minTargetViews",
            label: "Minimum target views (client orders)",
            type: "number",
            placeholder: "e.g. 200 — floor when clients buy view packages",
          },
        ]}
        defaultItemReward={2}
        itemLabel="video"
        itemPlaceholder="e.g. Product launch teaser — watch 45s for reward"
        itemDescriptionPlaceholder="What the video is about, language, and any rules (sound on, full watch, etc.)."
        itemRewardPlaceholder="KES paid per user after threshold is met and admin approves"
        itemFields={videoItemFields}
        descriptionMultiline
        collapseScheduleInTable
        itemTableShowBrief={false}
      />
    </AppShell>
  );
}
