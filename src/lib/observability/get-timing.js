import { logInfo } from "@/lib/observability/logger";

const SAMPLES_MAX = 200;
const samples = new Map();

function recordSample(route, durMs, cacheHit) {
  if (!samples.has(route)) samples.set(route, []);
  const list = samples.get(route);
  list.push({ durMs, cacheHit, at: Date.now() });
  if (list.length > SAMPLES_MAX) list.shift();
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function createGetTimer(route) {
  const start = performance.now();
  let cacheHit = false;
  return {
    markCacheHit() {
      cacheHit = true;
    },
    finish(response) {
      const durMs = Number((performance.now() - start).toFixed(1));
      recordSample(route, durMs, cacheHit);
      if (response?.headers) {
        response.headers.set("Server-Timing", `${route};dur=${durMs}`);
        if (cacheHit) response.headers.set("X-Cache", "HIT");
      }
      if (process.env.GET_TIMING_LOG === "1" || durMs >= 500) {
        logInfo("get.timing", { route, durMs, cacheHit });
      }
      return response;
    },
  };
}

export function getGetTimingStats(route) {
  const list = samples.get(route) || [];
  const durations = list.map((s) => s.durMs).sort((a, b) => a - b);
  return {
    count: durations.length,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    cacheHitRate: list.length ? list.filter((s) => s.cacheHit).length / list.length : 0,
  };
}

export function withPrivateCacheControl(response, maxAgeSec) {
  if (response?.headers && maxAgeSec > 0) {
    response.headers.set("Cache-Control", `private, max-age=${maxAgeSec}`);
  }
  return response;
}
