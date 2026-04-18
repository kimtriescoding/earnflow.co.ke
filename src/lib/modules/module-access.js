/**
 * `module_status` Settings value: flags are **enabled** when truthy or missing; disabled only when `=== false`.
 * Lucky Spin and Aviator use `lucky_spin` and `aviator` respectively. Legacy installs may only have `game`;
 * when those keys are missing, they inherit `game` (both off if `game === false`).
 */

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function normalizeModuleAccess(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const gameLegacy = r.game !== false;
  const anyGameSubKey = hasOwn(r, "lucky_spin") || hasOwn(r, "aviator");
  const lucky_spin = hasOwn(r, "lucky_spin") ? r.lucky_spin !== false : anyGameSubKey ? false : gameLegacy;
  const aviator = hasOwn(r, "aviator") ? r.aviator !== false : anyGameSubKey ? false : gameLegacy;

  return {
    video: r.video !== false,
    task: r.task !== false,
    academic: r.academic !== false,
    chat: r.chat !== false,
    lucky_spin,
    aviator,
    /** True when either minigame is enabled (for legacy callers). */
    game: lucky_spin || aviator,
  };
}

/** @param {keyof ReturnType<typeof normalizeModuleAccess>} key */
export function isModuleEnabled(raw, key) {
  return normalizeModuleAccess(raw)[key];
}

/**
 * Maps unified transaction `area` (user wallet feed) to a `module_status` key.
 * @returns {keyof ReturnType<typeof normalizeModuleAccess> | null} `null` = always visible (e.g. main wallet).
 */
export function transactionAreaToModuleKey(area) {
  const a = String(area || "").trim();
  if (a === "lucky_spin") return "lucky_spin";
  if (a === "aviator") return "aviator";
  return null;
}

/** @param {ReturnType<typeof normalizeModuleAccess>} access */
export function isTransactionAreaEnabled(access, area) {
  const mk = transactionAreaToModuleKey(area);
  if (!mk) return true;
  return Boolean(access[mk]);
}

/**
 * Maps earning `source` (and optional metadata) to a `module_status` key.
 * @returns {keyof ReturnType<typeof normalizeModuleAccess> | null}
 */
export function earningSourceToModuleKey(source, metadata = {}) {
  const s = String(source || "").trim().toLowerCase();
  if (s === "video") return "video";
  if (s === "task") return "task";
  if (s === "chat") return "chat";
  if (s === "academic") return "academic";
  if (s === "game") {
    const gt = String(metadata?.gameType || "").trim().toLowerCase();
    if (gt === "lucky_spin") return "lucky_spin";
    if (gt === "aviator") return "aviator";
    return null;
  }
  return null;
}

/** @param {ReturnType<typeof normalizeModuleAccess>} access */
export function isEarningSourceEnabled(access, source, metadata = {}) {
  const mk = earningSourceToModuleKey(source, metadata);
  if (!mk) return true;
  return Boolean(access[mk]);
}

/**
 * Mongo `$nor` patterns: documents matching any pattern are excluded from results.
 * @param {ReturnType<typeof normalizeModuleAccess>} access
 */
export function earningEventForbiddenPatterns(access) {
  const f = [];
  if (!access.video) f.push({ source: "video" });
  if (!access.task) f.push({ source: "task" });
  if (!access.chat) f.push({ source: "chat" });
  if (!access.academic) f.push({ source: "academic" });
  if (!access.lucky_spin) f.push({ source: "game", "metadata.gameType": "lucky_spin" });
  if (!access.aviator) f.push({ source: "game", "metadata.gameType": "aviator" });
  if (!access.lucky_spin && !access.aviator) {
    f.push({
      $and: [{ source: "game" }, { $or: [{ "metadata.gameType": { $exists: false } }, { "metadata.gameType": null }, { "metadata.gameType": "" }] }],
    });
  }
  return f;
}

/** @param {ReturnType<typeof normalizeModuleAccess>} access */
export function earningEventAccessMatch(access) {
  const patterns = earningEventForbiddenPatterns(access);
  return patterns.length ? { $nor: patterns } : {};
}

/**
 * @deprecated Use {@link earningEventForbiddenPatterns} / {@link earningEventAccessMatch}.
 * @param {ReturnType<typeof normalizeModuleAccess>} access
 */
export function moduleDisabledEarningSources(access) {
  const out = [];
  if (!access.video) out.push("video");
  if (!access.task) out.push("task");
  if (!access.chat) out.push("chat");
  if (!access.academic) out.push("academic");
  if (!access.lucky_spin && !access.aviator) out.push("game");
  return out;
}

/** @param {ReturnType<typeof normalizeModuleAccess>} access */
export function stripDisabledModuleStats(access, stats = {}) {
  const out = { ...stats };
  if (!access.video) delete out.video;
  if (!access.task) delete out.task;
  if (!access.chat) delete out.chat;
  if (!access.academic) delete out.academic;
  if (!access.lucky_spin) delete out.lucky_spin;
  if (!access.aviator) delete out.aviator;
  delete out.game;
  return out;
}

/** Aggregate stage: split `source: "game"` into `lucky_spin` / `aviator` buckets for `$group`. */
export const EARNING_MODULE_BUCKET_ADD_FIELDS = {
  $addFields: {
    earningsBucket: {
      $cond: [
        { $and: [{ $eq: ["$source", "game"] }, { $eq: ["$metadata.gameType", "lucky_spin"] }] },
        "lucky_spin",
        {
          $cond: [
            { $and: [{ $eq: ["$source", "game"] }, { $eq: ["$metadata.gameType", "aviator"] }] },
            "aviator",
            "$source",
          ],
        },
      ],
    },
  },
};

/** @param {Array<{ href: string; label: string; icon: string; moduleKey?: string }>} items */
export function filterUserNavItems(items, access) {
  return items.filter((item) => {
    const k = item.moduleKey;
    if (!k) return true;
    return Boolean(access[k]);
  });
}
