"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAppShell } from "@/components/user/UserAppShell";
import { UserDataTable } from "@/components/user/UserDataTable";
import { StatusChip } from "@/components/ui/StatusChip";

function getVideoEmbedSrc(url) {
  const s = String(url || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (host.includes("vimeo.com")) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function isLikelyMp4Url(url) {
  return /\.mp4(\?|$)/i.test(String(url || ""));
}

/** Autoplay in embeds; muted where hosts require it for autoplay to succeed in browsers. */
function withEmbedAutoplay(embedSrc) {
  const s = String(embedSrc || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host.endsWith(".youtube-nocookie.com")) {
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("mute", "1");
      u.searchParams.set("playsinline", "1");
      return u.toString();
    }
    if (host.includes("vimeo.com")) {
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("muted", "1");
      return u.toString();
    }
    return s;
  } catch {
    return s;
  }
}

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

function AutoplaySoundHint() {
  return (
    <p className="mt-2 text-xs text-[var(--muted)]">
      Playback starts automatically and may be muted; use the player controls to turn sound on.
    </p>
  );
}

export default function VideosPage() {
  const [tab, setTab] = useState("available");
  const [videos, setVideos] = useState([]);
  const [rows, setRows] = useState([]);
  const [watchItem, setWatchItem] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [claiming, setClaiming] = useState(false);
  /** One auto-submit attempt per modal session; cleared on failure so we can retry. */
  const autoSubmitStartedRef = useRef(false);

  const loadVideos = useCallback(() => {
    fetch("/api/modules/video/items")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const list = [...(data.data || [])].sort(
            (a, b) => Number(Boolean(a.alreadySubmitted)) - Number(Boolean(b.alreadySubmitted))
          );
          setVideos(list);
        } else toast.error(data.message || "Could not load videos.");
      })
      .catch(() => toast.error("Could not load videos."));
  }, []);

  const loadActivity = useCallback(() => {
    fetch("/api/dashboard/activity?source=video&page=1&pageSize=50")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRows((data.data || []).filter((r) => r.type === "earning"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadVideos();
    loadActivity();
  }, [loadVideos, loadActivity]);

  useEffect(() => {
    setElapsed(0);
    autoSubmitStartedRef.current = false;
  }, [watchItem?._id]);

  useEffect(() => {
    if (!watchItem?._id) return undefined;
    if (watchItem.alreadySubmitted) return undefined;
    const tick = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(tick);
  }, [watchItem?._id, watchItem?.alreadySubmitted]);

  const threshold = watchItem ? Math.max(1, Number(watchItem.thresholdSeconds || 0)) : 0;
  const thresholdMet = Boolean(watchItem && elapsed >= threshold);

  const submitWatch = useCallback(async () => {
    if (!watchItem || watchItem.alreadySubmitted) return;
    const th = Math.max(1, Number(watchItem.thresholdSeconds || 0));
    if (elapsed < th) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/modules/video/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: watchItem._id,
          watchedSeconds: elapsed,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.data?.status === "approved") {
          toast.success("Watch recorded. Your reward is confirmed.");
        } else {
          toast.success("Watch recorded. Reward is pending review.");
        }
        setWatchItem(null);
        loadVideos();
        loadActivity();
        setTab("history");
      } else {
        toast.error(data.message || "Could not submit watch.");
      }
    } catch {
      toast.error("Could not submit watch.");
    } finally {
      setClaiming(false);
    }
  }, [watchItem, elapsed, loadVideos, loadActivity]);

  useEffect(() => {
    if (!watchItem || watchItem.alreadySubmitted || !thresholdMet || autoSubmitStartedRef.current || claiming) return;
    autoSubmitStartedRef.current = true;
    void submitWatch();
  }, [watchItem, thresholdMet, claiming, submitWatch]);

  const historyColumns = [
    {
      field: "title",
      header: "Video",
      sortable: false,
      render: (r) => r.metadata?.title || r.metadata?.videoId || "—",
    },
    {
      field: "watched",
      header: "Watched",
      sortable: false,
      render: (r) => {
        const w = r.metadata?.watchedSeconds;
        const t = r.metadata?.threshold;
        if (w == null) return "—";
        return t != null ? `${w}s / ${t}s` : `${w}s`;
      },
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

  const url = watchItem ? String(watchItem.metadata?.videoUrl || "").trim() : "";
  const embedSrc = url ? getVideoEmbedSrc(url) : null;
  const embedSrcAutoplay = embedSrc ? withEmbedAutoplay(embedSrc) : null;
  const mp4 = url && isLikelyMp4Url(url);
  const replayOnly = Boolean(watchItem?.alreadySubmitted);

  return (
    <UserAppShell title="Watch & Earn">
      <div className="card-surface rounded-3xl section-card">
        <h2 className="heading-display text-lg font-semibold">Video earning</h2>
        <p className="mt-1 text-sm muted-text">
          Open a video and keep this page open. When you reach the required watch time, your watch is submitted automatically. Each video is
          only counted once for a reward while your submission is pending or approved. Videos you already submitted stay in the list so you
          can replay them—they show as <span className="font-medium text-[var(--foreground)]">Already counted</span> and do not send
          another reward.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={tab === "available" ? "primary-btn px-4 py-2 text-sm" : "secondary-btn px-4 py-2 text-sm"}
            onClick={() => setTab("available")}
          >
            Available videos
          </button>
          <button
            type="button"
            className={tab === "history" ? "primary-btn px-4 py-2 text-sm" : "secondary-btn px-4 py-2 text-sm"}
            onClick={() => setTab("history")}
          >
            Watch history
          </button>
        </div>
      </div>

      {tab === "available" ? (
        <div className="space-y-3">
          {videos.length === 0 ? (
            <div className="card-surface rounded-3xl p-8 text-center text-sm muted-text">
              No videos to watch right now. Check back later.
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {videos.map((v) => (
                <li key={v._id} className="card-surface flex flex-col rounded-3xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="heading-display text-base font-semibold">{v.title}</h3>
                    {v.alreadySubmitted ? <StatusChip status="approved" label="Already counted" /> : null}
                  </div>
                  {v.description ? <p className="mt-2 line-clamp-2 text-sm muted-text">{v.description}</p> : null}
                  <dl className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between gap-2">
                      <dt>Reward</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{Number(v.reward || 0).toFixed(2)} KES</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Watch at least</dt>
                      <dd>{Math.max(0, Number(v.thresholdSeconds || 0))} seconds</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Window</dt>
                      <dd className="max-w-[65%] text-right leading-tight">{formatWindow(v.metadata?.startsAt, v.metadata?.deadline)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className={`mt-4 w-full px-4 py-2 text-sm ${v.alreadySubmitted ? "secondary-btn" : "primary-btn"}`}
                    disabled={!v.metadata?.videoUrl}
                    onClick={() => setWatchItem(v)}
                  >
                    {!v.metadata?.videoUrl ? "Video link missing" : v.alreadySubmitted ? "Watch again" : "Watch & earn"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <UserDataTable
          title="Your watch history"
          columns={historyColumns}
          rows={rows.map((r) => ({ ...r, id: r.id }))}
          total={rows.length}
          page={1}
          pageSize={50}
          search=""
          sortState={{ field: "createdAt", direction: "desc" }}
          onSearchChange={() => {}}
          onSortChange={() => {}}
          onPageChange={() => {}}
          emptyLabel="No video watches yet."
        />
      )}

      {watchItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-surface flex max-h-[min(92vh,800px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4 sm:p-5">
              <div>
                <div className="flex flex-wrap items-start gap-2">
                  <h4 className="heading-display text-base font-semibold">{watchItem.title}</h4>
                  {replayOnly ? <StatusChip status="approved" label="Already counted" /> : null}
                </div>
                {replayOnly ? (
                  <p className="mt-1 text-sm muted-text">
                    You already have a submission for this video. You can replay it here; no new reward will be added.
                  </p>
                ) : (
                  <p className="mt-1 text-sm muted-text">
                    Timer: <span className="font-mono tabular-nums text-[var(--foreground)]">{elapsed}s</span>
                    {" · "}
                    Need <span className="font-mono tabular-nums">{threshold}s</span>
                    {!thresholdMet ? (
                      <span className="text-[var(--muted)]"> — keep this page open while watching</span>
                    ) : (
                      <span className="text-[var(--muted)]"> — submitting your watch…</span>
                    )}
                  </p>
                )}
              </div>
              <button type="button" className="secondary-btn shrink-0 px-3 py-1.5 text-xs" onClick={() => setWatchItem(null)}>
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {!url ? (
                <p className="text-sm text-[var(--danger)]">This video has no URL configured.</p>
              ) : embedSrcAutoplay ? (
                <>
                  <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                    <iframe
                      key={embedSrcAutoplay}
                      title={watchItem.title}
                      src={embedSrcAutoplay}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <AutoplaySoundHint />
                </>
              ) : mp4 ? (
                <>
                  <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                    <video
                      key={watchItem._id}
                      src={url}
                      className="h-full w-full"
                      controls
                      playsInline
                      autoPlay
                      muted
                    />
                  </div>
                  <AutoplaySoundHint />
                </>
              ) : (
                <>
                  <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                    <iframe
                      key={url}
                      title={watchItem.title}
                      src={url}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    The video plays in this window. If it stays blank, the host may block embedding—YouTube, Vimeo, or a direct .mp4 link
                    usually works best.
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] p-4 sm:p-5">
              <p className="text-sm text-[var(--muted)]">
                {replayOnly
                  ? "Replay only — your watch is already on record."
                  : !thresholdMet
                    ? `${Math.max(0, threshold - elapsed)}s left — your watch is sent automatically at ${threshold}s.`
                    : "Hang on — confirming your watch…"}
              </p>
              <button type="button" className="secondary-btn px-4 py-2 text-sm" disabled={claiming} onClick={() => setWatchItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UserAppShell>
  );
}
