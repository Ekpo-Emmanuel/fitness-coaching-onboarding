import { validateSchemaDefinition } from "@/lib/onboarding/schema/definition";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import { SchemaParseError } from "./errors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseOnboardingSchema(input: unknown): OnboardingSchema {
  if (!isRecord(input)) {
    throw new SchemaParseError([{ path: "schema", message: "Schema must be an object." }]);
  }
  if (!Array.isArray(input.sections)) {
    throw new SchemaParseError([{ path: "sections", message: "Schema sections are required." }]);
  }
  if (!isRecord(input.intro) || !isRecord(input.success)) {
    throw new SchemaParseError([{ path: "schema", message: "Intro and success copy are required." }]);
  }
  const schema = input as unknown as OnboardingSchema;
  const issues = validateSchemaDefinition(schema);
  if (issues.length > 0) throw new SchemaParseError(issues);
  return structuredClone(schema);
}
