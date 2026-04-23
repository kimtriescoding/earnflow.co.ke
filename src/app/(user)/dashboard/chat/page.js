"use client";

import { UserAppShell } from "@/components/user/UserAppShell";

const CHAT_SIGNIN_URL = "https://www.rentacyberfriend.com/signin/";

export default function ChatPage() {
  return (
    <UserAppShell title="Chat" hideHeader>
      <div className="flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center p-6">
        <div className="card-strong neon-outline w-full max-w-lg rounded-[var(--radius-panel)] px-7 py-9 text-center md:px-10 md:py-11">
          <p className="eyebrow-label">Paid chat</p>
          <h2 className="heading-display mt-2 text-balance text-xl font-semibold leading-snug tracking-tight gradient-text md:text-2xl">
            Get paid to chat with people around the world
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            Rent a Cyber Friend matches you with clients who want real conversation — flexible hours, global audience,
            you choose how you show up.
          </p>
          <a
            href={CHAT_SIGNIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-btn mt-7 inline-flex min-w-[12.5rem] justify-center px-7 py-3 text-sm font-semibold"
          >
            Get started now
          </a>
          <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
            Already have an account?{" "}
            <a
              href={CHAT_SIGNIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--brand)] underline underline-offset-2 transition-colors hover:text-[var(--brand-strong)]"
            >
              Continue chatting
            </a>
            .
          </p>
        </div>
      </div>
    </UserAppShell>
  );
}
