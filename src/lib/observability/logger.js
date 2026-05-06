const LOG_LEVEL_PRIORITY = { debug: 10, info: 20, warn: 30, error: 40 };
const ACTIVE_LEVEL = String(process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "warn" : "info")).toLowerCase();

function shouldLog(level) {
  return (LOG_LEVEL_PRIORITY[level] || 99) >= (LOG_LEVEL_PRIORITY[ACTIVE_LEVEL] || 20);
}

export function logInfo(event, payload = {}) {
  if (!shouldLog("info")) return;
  console.log(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...payload }));
}

export function logError(event, payload = {}) {
  if (!shouldLog("error")) return;
  console.error(JSON.stringify({ level: "error", event, at: new Date().toISOString(), ...payload }));
}

export function logSecurity(event, payload = {}) {
  if (!shouldLog("warn")) return;
  console.warn(JSON.stringify({ level: "warn", category: "security", event, at: new Date().toISOString(), ...payload }));
}
