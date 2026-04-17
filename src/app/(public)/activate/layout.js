import { Suspense } from "react";

export default function ActivateLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="page-shell soft-gradient flex min-h-[50vh] items-center justify-center p-4">
          <p className="text-sm muted-text">Loading…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
