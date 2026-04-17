export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--muted)_18%,transparent)] ${className}`}
    />
  );
}
