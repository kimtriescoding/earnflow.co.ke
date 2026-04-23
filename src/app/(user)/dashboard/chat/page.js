"use client";

import { UserAppShell } from "@/components/user/UserAppShell";

const CHAT_EXTERNAL_URL = "https://www.rentacyberfriend.com/become-a-cyberfriend/#signup";

export default function ChatPage() {
  return (
    <UserAppShell title="Chat" compactSidebar hideHeader>
      <div className="flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center gap-5 p-6 text-center">
        <p className="max-w-md text-sm text-white/80">
          Paid chat runs on Rent a Cyber Friend. Open it in a new tab to continue — it cannot be shown inside this app.
        </p>
        <a
          href={CHAT_EXTERNAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-btn inline-flex px-6 py-3 text-sm font-semibold"
        >
          Open Rent a Cyber Friend
        </a>
      </div>
    </UserAppShell>
  );
}
