export const MODULE_SLUGS = ["video", "lucky-spin", "aviator", "academic", "task"];

export function normalizeModuleKey(slug = "") {
  return String(slug).trim().toLowerCase();
}

export function isSupportedModule(slug = "") {
  return MODULE_SLUGS.includes(normalizeModuleKey(slug));
}

export function toModuleType(slug = "") {
  const key = normalizeModuleKey(slug);
  return key === "lucky-spin" ? "lucky_spin" : key;
}

export function fromModuleType(type = "") {
  const key = String(type || "").trim().toLowerCase();
  return key === "lucky_spin" ? "lucky-spin" : key;
}

export function moduleStatusKey(slug = "") {
  const key = normalizeModuleKey(slug);
  return key === "lucky-spin" || key === "aviator" ? "game" : key;
}

export function moduleSettingsKey(slug = "") {
  const key = normalizeModuleKey(slug);
  if (key === "lucky-spin") return "module_lucky_spin_default";
  return `module_${key}_default`;
}

export function moduleSourceFilter(slug = "") {
  const key = normalizeModuleKey(slug);
  if (key === "lucky-spin") {
    return { source: "game", "metadata.gameType": "lucky_spin" };
  }
  if (key === "aviator") {
    return { source: "game", "metadata.gameType": "aviator" };
  }
  return { source: key };
}
