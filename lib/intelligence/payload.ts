import type { ClientIdentityMapping } from "@/lib/forms/identity";
import { collectAnswerKeys } from "@/lib/onboarding/schema/definition";
import type { OnboardingAnswers, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { allFields } from "@/lib/onboarding/schema/visibility";
import { formatAnswerValue } from "@/lib/submissions/display";
import type { CoachBriefInput, CoachBriefPayload, SourcedText } from "./types";
import { BRIEF_LIMITS, IntelligenceProviderError } from "./types";

const PAYLOAD_KEYS = new Set([
  "summary",
  "goals",
  "training",
  "nutrition",
  "lifestyleRecovery",
  "coachingPreferences",
  "thingsToReview",
  "kickoffTopics",
]);

const IDENTITY_KEYS = new Set(["full_name", "email", "phone", "date_of_birth", "first_name", "last_name"]);

export function excludedIdentityKeys(mapping: ClientIdentityMapping | null) {
  const keys = new Set(IDENTITY_KEYS);
  if (mapping?.fullNameFieldKey) keys.add(mapping.fullNameFieldKey);
  if (mapping?.emailFieldKey) keys.add(mapping.emailFieldKey);
  if (mapping?.phoneFieldKey) keys.add(mapping.phoneFieldKey);
  return keys;
}

export function buildCoachBriefInput(input: {
  schema: OnboardingSchema;
  answers: OnboardingAnswers;
  mapping: ClientIdentityMapping | null;
  reviewFlags: Array<{ code: string; label: string; sourceFieldKeys: string[] }>;
  coaching: CoachBriefInput["coaching"];
}): CoachBriefInput {
  const skip = excludedIdentityKeys(input.mapping);
  const fields = [];
  for (const section of input.schema.sections) {
    for (const field of section.fields) {
      if (skip.has(field.key) || field.type === "email" || field.type === "phone") continue;
      const formatted = formatAnswerValue(field, input.answers);
      if (!formatted || formatted === "—") continue;
      fields.push({
        section: section.title,
        key: field.key,
        label: field.label,
        type: field.type,
        answer: formatted.slice(0, BRIEF_LIMITS.maxAnswerChars),
      });
      if (fields.length >= BRIEF_LIMITS.maxAnswers) break;
    }
    if (fields.length >= BRIEF_LIMITS.maxAnswers) break;
  }
  return {
    fields,
    reviewFlags: input.reviewFlags.map((flag) => ({
      code: flag.code,
      label: flag.label,
      sourceFieldKeys: flag.sourceFieldKeys,
    })),
    coaching: input.coaching,
  };
}

export function assertNoIdentityLeak(modelInput: CoachBriefInput) {
  const joined = JSON.stringify(modelInput).toLowerCase();
  if (joined.includes("@") && /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(joined)) {
    throw new IntelligenceProviderError("malformed", "Identity data must not be sent to the model.");
  }
}

export function parseCoachBriefPayload(input: unknown, schema: OnboardingSchema): CoachBriefPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new IntelligenceProviderError("malformed");
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!PAYLOAD_KEYS.has(key)) throw new IntelligenceProviderError("malformed");
  }
  const allowed = new Set(collectAnswerKeys(schema));
  const summary = parseSourced(record.summary, allowed, true);
  const payload: CoachBriefPayload = { summary };
  payload.goals = parseList(record.goals, allowed);
  payload.training = parseList(record.training, allowed);
  payload.nutrition = parseList(record.nutrition, allowed);
  payload.lifestyleRecovery = parseList(record.lifestyleRecovery, allowed);
  payload.coachingPreferences = parseList(record.coachingPreferences, allowed);
  payload.thingsToReview = parseList(record.thingsToReview, allowed);
  payload.kickoffTopics = parseList(record.kickoffTopics, allowed);
  return payload;
}

function parseList(value: unknown, allowed: Set<string>) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > BRIEF_LIMITS.maxItems) {
    throw new IntelligenceProviderError("malformed");
  }
  return value.map((item) => parseSourced(item, allowed, false));
}

function parseSourced(value: unknown, allowed: Set<string>, required: boolean): SourcedText {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntelligenceProviderError("malformed");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "text" && key !== "sourceFieldKeys")) {
    throw new IntelligenceProviderError("malformed");
  }
  if (typeof record.text !== "string" || !record.text.trim()) {
    throw new IntelligenceProviderError("malformed");
  }
  if (record.text.length > BRIEF_LIMITS.maxTextChars) throw new IntelligenceProviderError("malformed");
  if (!Array.isArray(record.sourceFieldKeys) || record.sourceFieldKeys.length === 0) {
    throw new IntelligenceProviderError("malformed");
  }
  if (record.sourceFieldKeys.length > BRIEF_LIMITS.maxSourceKeys) throw new IntelligenceProviderError("malformed");
  const sourceFieldKeys: string[] = [];
  for (const key of record.sourceFieldKeys) {
    if (typeof key !== "string" || !allowed.has(key)) throw new IntelligenceProviderError("malformed");
    sourceFieldKeys.push(key);
  }
  if (!required && !record.text.trim()) throw new IntelligenceProviderError("malformed");
  return { text: record.text.trim(), sourceFieldKeys };
}

export function fieldLabelMap(schema: OnboardingSchema) {
  return new Map(allFields(schema).map((field) => [field.key, field.label]));
}
