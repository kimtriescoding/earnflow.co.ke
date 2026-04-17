export function logInfo(event, payload = {}) {
  console.log(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...payload }));
}

export function logError(event, payload = {}) {
  console.error(JSON.stringify({ level: "error", event, at: new Date().toISOString(), ...payload }));
}

export function logSecurity(event, payload = {}) {
  console.warn(JSON.stringify({ level: "warn", category: "security", event, at: new Date().toISOString(), ...payload }));
}
