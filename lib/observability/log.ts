type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    event,
    ...sanitize(meta ?? {}),
    t: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function sanitize(meta: Record<string, unknown>) {
  const blocked = /answer|payload|token|secret|password|email|phone|body|authorization|refresh/i;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (blocked.test(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) {
      out[key] = value;
    }
  }
  return out;
}

export const log = {
  info: (event: string, meta?: Record<string, unknown>) => emit("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit("error", event, meta),
};

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}
