import { CLIENT_FIELD_KEYS } from "@/lib/onboarding/schema/client-keys";
import { collectAnswerKeys } from "@/lib/onboarding/schema/definition";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import { LEGACY_SHEETS_SCHEMA_VERSION } from "./constants";

export function isLegacyV1Schema(schema: OnboardingSchema) {
  if (schema.schemaVersion !== LEGACY_SHEETS_SCHEMA_VERSION) return false;
  const keys = [...collectAnswerKeys(schema)].sort();
  const expected = [...CLIENT_FIELD_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}
