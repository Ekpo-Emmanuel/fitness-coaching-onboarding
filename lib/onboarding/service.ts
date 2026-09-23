import { randomUUID } from "node:crypto";
import { SCHEMA_VERSION } from "./constants";
import { buildHealthFlags } from "./health-flags";
import { saveOnboarding } from "../sheets/repository";
import type { StoredOnboarding, ValidatedOnboarding } from "./types";

export async function submitOnboarding(data: ValidatedOnboarding): Promise<StoredOnboarding> {
  const flags = buildHealthFlags(data);
  const record: StoredOnboarding = {
    ...data,
    submission_id: randomUUID(),
    submitted_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    onboarding_status: "submitted",
    coach_notes: "",
    ...flags,
  };
  await saveOnboarding(record);
  return record;
}
