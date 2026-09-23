import { ValidationError } from "@/lib/onboarding/schema/engine";

const MAX_JSON_BYTES = 64_000;
const MAX_KEYS = 120;
const MAX_STRING = 4_000;
const ATTEMPT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertPayloadSize(raw: string) {
  if (Buffer.byteLength(raw, "utf8") > MAX_JSON_BYTES) {
    throw new ValidationError({ form: "This submission is too large." });
  }
}

export function assertAnswerBounds(answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new ValidationError({ form: "Send answers as an object." });
  }
  const entries = Object.entries(answers as Record<string, unknown>);
  if (entries.length > MAX_KEYS) throw new ValidationError({ form: "Too many answers." });
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.length > MAX_STRING) {
      throw new ValidationError({ [key]: "This answer is too long." });
    }
  }
}

export function parseSubmissionAttemptId(value: unknown) {
  if (typeof value !== "string" || !ATTEMPT_RE.test(value)) {
    throw new ValidationError({ form: "This onboarding could not be submitted. Refresh and try again." });
  }
  return value;
}

export function assertBotSignals(input: { honeypot?: unknown; startedAt?: unknown }, now = Date.now()) {
  if (typeof input.honeypot === "string" && input.honeypot.trim()) {
    throw new ValidationError({ form: "This onboarding could not be submitted." });
  }
  const started = typeof input.startedAt === "number" ? input.startedAt : Number(input.startedAt);
  if (!Number.isFinite(started) || now - started < 1_500 || now - started > 1000 * 60 * 60 * 12) {
    throw new ValidationError({ form: "Take a moment to complete the onboarding, then submit again." });
  }
}

export function clampText(value: string, max = MAX_STRING) {
  return value.slice(0, max);
}
