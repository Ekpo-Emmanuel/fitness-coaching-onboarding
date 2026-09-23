import { and, eq } from "drizzle-orm";
import { form, formVersion, submission } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { CLIENT_FIELD_KEYS } from "@/lib/onboarding/schema/client-keys";
import { submitToExactVersion } from "@/lib/submissions/service";
import type { StoredOnboarding } from "@/lib/onboarding/types";

export type ImportReport = {
  rowsProcessed: number;
  clientsCreated: number;
  clientsReused: number;
  ambiguousMatches: number;
  submissionsImported: number;
  rowsSkipped: number;
  errors: Array<{ submissionId: string; message: string }>;
};

function answersFromLegacy(record: StoredOnboarding) {
  const answers: Record<string, unknown> = {};
  for (const key of CLIENT_FIELD_KEYS) {
    answers[key] = record[key];
  }
  return answers;
}

export async function importV1Submissions(
  db: FormsDatabase,
  input: {
    workspaceId: string;
    slug?: string;
    rows: StoredOnboarding[];
    commit: boolean;
  },
) {
  const slug = input.slug ?? "emmanuel-onboarding";
  const published = await db
    .select({ form, version: formVersion })
    .from(form)
    .innerJoin(formVersion, eq(formVersion.formId, form.id))
    .where(and(eq(form.workspaceId, input.workspaceId), eq(form.slug, slug), eq(formVersion.versionNumber, 1)))
    .limit(1);
  if (!published[0]) {
    throw new Error("Seeded V1 form Version 1 was not found. Run npm run seed:v1-form first.");
  }

  const report: ImportReport = {
    rowsProcessed: 0,
    clientsCreated: 0,
    clientsReused: 0,
    ambiguousMatches: 0,
    submissionsImported: 0,
    rowsSkipped: 0,
    errors: [],
  };

  for (const row of input.rows) {
    report.rowsProcessed += 1;
    if (!row.submission_id) {
      report.rowsSkipped += 1;
      continue;
    }
    const existing = await db
      .select({ id: submission.id })
      .from(submission)
      .where(
        and(eq(submission.workspaceId, input.workspaceId), eq(submission.legacySubmissionId, row.submission_id)),
      )
      .limit(1);
    if (existing[0]) {
      report.rowsSkipped += 1;
      continue;
    }
    if (!input.commit) {
      report.submissionsImported += 1;
      continue;
    }
    try {
      const result = await submitToExactVersion(db, {
        formId: published[0].form.id,
        versionNumber: 1,
        workspaceId: input.workspaceId,
        answers: answersFromLegacy(row),
        source: "legacy_import",
        legacySubmissionId: row.submission_id,
        notes: row.coach_notes || null,
        submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
        legacyFlagCodes: row.health_flag_reasons,
      });
      if (result.clientResolution === "created") report.clientsCreated += 1;
      else if (result.clientResolution === "reused") report.clientsReused += 1;
      else report.ambiguousMatches += 1;
      report.submissionsImported += 1;
    } catch (error) {
      report.errors.push({
        submissionId: row.submission_id,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  return report;
}
