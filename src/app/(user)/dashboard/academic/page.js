"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAppShell } from "@/components/user/UserAppShell";
import { UserDataTable } from "@/components/user/UserDataTable";
import { StatusChip } from "@/components/ui/StatusChip";

function formatCompactDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function formatWindow(startIso, endIso) {
  const a = formatCompactDateTime(startIso);
  const b = formatCompactDateTime(endIso);
  if (!a && !b) return "—";
  return `${a || "…"} → ${b || "…"}`;
}

export default function AcademicPage() {
  const [tab, setTab] = useState("available");
  const [tasks, setTasks] = useState([]);
  const [rows, setRows] = useState([]);
  const [taskForView, setTaskForView] = useState(null);
  const [modalTask, setModalTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const loadTasks = useCallback(() => {
    fetch("/api/modules/academic/tasks")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setTasks(data.data || []);
        else toast.error(data.message || "Could not load tasks.");
      })
      .catch(() => toast.error("Could not load tasks."));
  }, []);

  const loadActivity = useCallback(() => {
    fetch("/api/dashboard/activity?source=academic&page=1&pageSize=50")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRows((data.data || []).filter((r) => r.type === "earning"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTasks();
    loadActivity();
  }, [loadTasks, loadActivity]);

  function openSubmit(task) {
    setModalTask(task);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openSubmitFromView(task) {
    setTaskForView(null);
    openSubmit(task);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!modalTask) return;
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      toast.error("Choose a PDF file to upload.");
      return;
    }
    const name = String(file.name || "").toLowerCase();
    if (file.type !== "application/pdf" && !name.endsWith(".pdf")) {
      toast.error("Only PDF files are accepted.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("assignmentId", modalTask._id);
      fd.append("title", modalTask.title);
      fd.append("file", file);

      const res = await fetch("/api/modules/academic/submit", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        toast.success("PDF submitted. Awaiting review.");
        setModalTask(null);
        if (input) input.value = "";
        loadTasks();
        loadActivity();
        setTab("submitted");
      } else {
        toast.error(data.message || "Submission failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const submittedColumns = [
    {
      field: "title",
      header: "Title",
      sortable: false,
      render: (r) => r.metadata?.title || "—",
    },
    {
      field: "submission",
      header: "Document",
      sortable: false,
      render: (r) => {
        if (r.metadata?.submissionStorageFile) {
          return (
            <a
              href={`/api/modules/academic/submissions/${r.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--brand)] underline underline-offset-2"
            >
              View PDF
            </a>
          );
        }
        const href = String(r.metadata?.submissionUrl || "").trim();
        if (!href) return "—";
        return (
          <a href={href} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand)] underline underline-offset-2">
            Open link
          </a>
        );
      },
    },
    {
      field: "wordCount",
      header: "Words",
      sortable: false,
      render: (r) => (r.metadata?.wordCount != null ? String(r.metadata.wordCount) : "—"),
    },
    { field: "amount", header: "Reward (KES)", sortable: false, render: (r) => Number(r.amount || 0).toFixed(2) },
    {
      field: "status",
      header: "Status",
      sortable: false,
      render: (r) => <StatusChip status={r.status} />,
    },
    { field: "createdAt", header: "Date", sortable: false, render: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <UserAppShell title="Academic Work">
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Academic earning</h2>
        <p className="mt-1 text-sm muted-text">
          Open a task, upload your work as a PDF, and wait for admin review. Word count is detected from your file — you do not enter it
          manually.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={tab === "available" ? "primary-btn px-4 py-2 text-sm" : "secondary-btn px-4 py-2 text-sm"}
            onClick={() => setTab("available")}
          >
            Available tasks
          </button>
          <button
            type="button"
            className={tab === "submitted" ? "primary-btn px-4 py-2 text-sm" : "secondary-btn px-4 py-2 text-sm"}
            onClick={() => setTab("submitted")}
          >
            Submitted academics
          </button>
        </div>
      </div>

      {tab === "available" ? (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="card-surface rounded-3xl p-8 text-center text-sm muted-text">No open tasks right now. Check back later.</div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {tasks.map((t) => (
                <li key={t._id} className="card-surface flex flex-col rounded-3xl p-5">
                  <h3 className="heading-display text-base font-semibold">{t.title}</h3>
                  {t.description ? (
                    <p className="mt-2 text-sm muted-text line-clamp-2">{t.description}</p>
                  ) : null}
                  <dl className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between gap-2">
                      <dt>Reward</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{Number(t.reward || 0).toFixed(2)} KES</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Opens / due</dt>
                      <dd className="max-w-[65%] text-right leading-tight">{formatWindow(t.metadata?.startsAt, t.metadata?.deadline)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Min words</dt>
                      <dd>{Number(t.metadata?.minWords ?? 0) > 0 ? t.metadata.minWords : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Format</dt>
                      <dd className="line-clamp-2 text-right">{t.metadata?.format || "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button type="button" className="secondary-btn w-full px-4 py-2 text-sm sm:flex-1" onClick={() => setTaskForView(t)}>
                      View task
                    </button>
                    <button type="button" className="primary-btn w-full px-4 py-2 text-sm sm:flex-1" onClick={() => openSubmit(t)}>
                      Submit PDF
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <UserDataTable
          title="Your academic submissions"
          columns={submittedColumns}
          rows={rows.map((r) => ({ ...r, id: r.id }))}
          total={rows.length}
          page={1}
          pageSize={50}
          search=""
          sortState={{ field: "createdAt", direction: "desc" }}
          onSearchChange={() => {}}
          onSortChange={() => {}}
          onPageChange={() => {}}
          emptyLabel="No academic submissions yet."
        />
      )}

      {taskForView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-surface max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-3xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h4 className="heading-display text-base font-semibold">{taskForView.title}</h4>
              <button type="button" className="secondary-btn shrink-0 px-3 py-1.5 text-xs" onClick={() => setTaskForView(null)}>
                Close
              </button>
            </div>
            {taskForView.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{taskForView.description}</p>
            ) : null}
            <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
              Submit your answer as one PDF file. Minimum word count (if any) is checked automatically from the text in your PDF.
            </p>
            <dl className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="muted-text">Reward</dt>
                <dd className="font-medium tabular-nums">{Number(taskForView.reward || 0).toFixed(2)} KES</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted-text">Opens / due</dt>
                <dd className="max-w-[60%] text-right text-xs leading-tight">
                  {formatWindow(taskForView.metadata?.startsAt, taskForView.metadata?.deadline)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted-text">Min words</dt>
                <dd>{Number(taskForView.metadata?.minWords ?? 0) > 0 ? taskForView.metadata.minWords : "—"}</dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <dt className="muted-text shrink-0">Format</dt>
                <dd className="text-right sm:max-w-[70%]">{taskForView.metadata?.format || "—"}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row">
              <button type="button" className="secondary-btn w-full px-4 py-2 text-sm sm:flex-1" onClick={() => setTaskForView(null)}>
                Close
              </button>
              <button
                type="button"
                className="primary-btn w-full px-4 py-2 text-sm sm:flex-1"
                onClick={() => openSubmitFromView(taskForView)}
              >
                Submit PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-md rounded-3xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h4 className="heading-display text-base font-semibold">Submit PDF: {modalTask.title}</h4>
              <button type="button" className="secondary-btn px-3 py-1.5 text-xs" onClick={() => setModalTask(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="muted-text">PDF document</span>
                <input
                  ref={fileInputRef}
                  className="interactive-control focus-ring cursor-pointer px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                />
                <span className="text-xs text-[var(--muted)]">Max about 12 MB. Word count is read from the PDF text (not images).</span>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" className="primary-btn px-4 py-2 text-sm" disabled={submitting}>
                  {submitting ? "Uploading…" : "Submit"}
                </button>
                <button type="button" className="secondary-btn px-4 py-2 text-sm" onClick={() => setModalTask(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </UserAppShell>
  );
}
