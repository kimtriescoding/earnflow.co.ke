"use client";

import { UserAppShell } from "@/components/user/UserAppShell";

const CHAT_IFRAME_SRC = "https://orionchathub.com/register?as=host";

export default function ChatPage() {
  return (
    <UserAppShell title="Chat" compactSidebar hideHeader>
      <iframe
        src={CHAT_IFRAME_SRC}
        title="Chat host dashboard"
        className="m-0 block h-[calc(100dvh-3.25rem)] w-full border-0 p-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </UserAppShell>
  );
}
