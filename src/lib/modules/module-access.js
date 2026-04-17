/**
 * `module_status` Settings value: flags are **enabled** when truthy or missing; disabled only when `=== false`.
 * Keys: video, task, game, academic, chat (extensible).
 */

export function normalizeModuleAccess(raw = {}) {
  return {
    video: raw.video !== false,
    task: raw.task !== false,
    game: raw.game !== false,
    academic: raw.academic !== false,
    chat: raw.chat !== false,
  };
}

/** @param {keyof ReturnType<typeof normalizeModuleAccess>} key */
export function isModuleEnabled(raw, key) {
  return normalizeModuleAccess(raw)[key];
}

/** @param {Array<{ href: string; label: string; icon: string; moduleKey?: string }>} items */
export function filterUserNavItems(items, access) {
  return items.filter((item) => {
    const k = item.moduleKey;
    if (!k) return true;
    return Boolean(access[k]);
  });
}
