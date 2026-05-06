export default function UserLoading() {
  return (
    <div className="page-shell soft-gradient p-6">
      <div className="content-container">
        <div className="card-surface animate-pulse rounded-3xl p-6">
          <div className="h-5 w-48 rounded bg-[var(--surface-soft)]" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="h-24 rounded-2xl bg-[var(--surface-soft)]" />
            <div className="h-24 rounded-2xl bg-[var(--surface-soft)]" />
            <div className="h-24 rounded-2xl bg-[var(--surface-soft)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
