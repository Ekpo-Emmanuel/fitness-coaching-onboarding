import { and, eq } from "drizzle-orm";
import { coachBrief, form, formVersion, reviewFlag, submission } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { resolveOrCreateClient } from "@/lib/clients/resolve";
import { FormServiceError, SchemaParseError } from "@/lib/forms/errors";
import { assertCollectibleMapping, extractClientIdentity } from "@/lib/forms/identity";
import { parseOnboardingSchema } from "@/lib/forms/parse-schema";
import { ValidationError, validateAnswers } from "@/lib/onboarding/schema/engine";
import type { OnboardingAnswers } from "@/lib/onboarding/schema/types";
import { evaluateReviewRules } from "@/lib/review/evaluate";
import { flagsFromLegacyReasons } from "@/lib/review/legacy-map";
import { parseReviewRuleSet } from "@/lib/review/validate";
import type { ReviewFlagCandidate } from "@/lib/review/types";
import { attemptDeliveries, createSubmissionDeliveries } from "@/lib/integrations/service";
import type { DestinationOptions } from "@/lib/integrations/registry";
import { assertAnswerBounds } from "@/lib/security/payload";

export async function persistCanonicalSubmission(
  db: FormsDatabase,
  input: {
    form: typeof form.$inferSelect;
    version: typeof formVersion.$inferSelect;
    answers: unknown;
    source?: "public_form" | "legacy_import";
    legacySubmissionId?: string;
    notes?: string | null;
    submittedAt?: Date;
    legacyFlagCodes?: string[];
    destinationOptions?: DestinationOptions;
    skipDeliveryAttempt?: boolean;
    submissionAttemptId?: string;
    skipBotChecks?: boolean;
  },
) {
  if (input.submissionAttemptId) {
    const existing = await db
      .select({ id: submission.id })
      .from(submission)
      .where(
        and(eq(submission.formVersionId, input.version.id), eq(submission.submissionAttemptId, input.submissionAttemptId)),
      )
      .limit(1);
    if (existing[0]) {
      return {
        submissionId: existing[0].id,
        formVersionId: input.version.id,
        versionNumber: input.version.versionNumber,
        clientResolution: "reused" as const,
        reviewStatus: "new" as const,
        flagCount: 0,
        workspaceId: input.form.workspaceId,
        deliveryIds: [] as string[],
        replayed: true,
      };
    }
  }
  let schema;
  try {
    schema = parseOnboardingSchema(input.version.schema);
  } catch (error) {
    if (error instanceof SchemaParseError) throw new FormServiceError("This onboarding is unavailable.", 404);
    throw error;
  }
  const mapping = assertCollectibleMapping(schema, input.version.clientIdentityMapping);
  const answers = validateAnswers(schema, input.answers) as OnboardingAnswers;
  assertAnswerBounds(answers);
  const identity = extractClientIdentity(answers, mapping);
  const rules = parseReviewRuleSet(input.version.reviewRules);
  let flags: ReviewFlagCandidate[] = evaluateReviewRules({ rules, answers, schema });
  if (flags.length === 0 && !rules && input.legacyFlagCodes?.length) {
    flags = flagsFromLegacyReasons(input.legacyFlagCodes);
  }
  const reviewStatus = flags.length > 0 ? "needs_review" : "new";

  const result = await db.transaction(async (tx) => {
    const resolved = await resolveOrCreateClient(tx, input.form.workspaceId, identity);
    const [created] = await tx
      .insert(submission)
      .values({
        workspaceId: input.form.workspaceId,
        clientId: resolved.client.id,
        formId: input.form.id,
        formVersionId: input.version.id,
        answers,
        reviewStatus,
        source: input.source ?? "public_form",
        legacySubmissionId: input.legacySubmissionId ?? null,
        notes: input.notes ?? null,
        submissionAttemptId: input.submissionAttemptId ?? null,
        submittedAt: input.submittedAt ?? new Date(),
      })
      .returning();
    if (flags.length) {
      await tx.insert(reviewFlag).values(
        flags.map((flag) => ({
          workspaceId: input.form.workspaceId,
          submissionId: created.id,
          ruleId: flag.ruleId,
          code: flag.code,
          label: flag.label,
          sourceFieldKeys: flag.sourceFieldKeys,
        })),
      );
    }
    await tx.insert(coachBrief).values({
      workspaceId: input.form.workspaceId,
      submissionId: created.id,
      status: "pending",
    });
    const deliveryIds = await createSubmissionDeliveries(tx, {
      workspaceId: input.form.workspaceId,
      source: input.source ?? "public_form",
      client: resolved.client,
      form: { id: input.form.id, name: input.form.name },
      version: { versionNumber: input.version.versionNumber, schema },
      submission: {
        id: created.id,
        submittedAt: created.submittedAt,
        reviewStatus,
        answers,
      },
      reviewFlags: flags,
    });
    return {
      submissionId: created.id,
      formVersionId: input.version.id,
      versionNumber: input.version.versionNumber,
      clientResolution: resolved.resolution,
      reviewStatus,
      flagCount: flags.length,
      workspaceId: input.form.workspaceId,
      deliveryIds,
      replayed: false as const,
    };
  });
  if (!input.skipDeliveryAttempt && result.deliveryIds.length) {
    await attemptDeliveries(db, result.workspaceId, result.deliveryIds, input.destinationOptions);
  }
  return result;
}

export async function submitPublishedForm(
  db: FormsDatabase,
  input: {
    slug: string;
    answers: unknown;
    source?: "public_form" | "legacy_import";
    legacySubmissionId?: string;
    notes?: string | null;
    submittedAt?: Date;
    legacyFlagCodes?: string[];
    destinationOptions?: DestinationOptions;
    skipDeliveryAttempt?: boolean;
    submissionAttemptId?: string;
  },
) {
  const published = await db
    .select({
      form,
      version: formVersion,
    })
    .from(form)
    .innerJoin(formVersion, eq(form.activePublishedVersionId, formVersion.id))
    .where(eq(form.slug, input.slug))
    .limit(1);
  const row = published[0];
  if (!row || row.form.status !== "published") {
    throw new FormServiceError("This onboarding is unavailable.", 404);
  }
  return persistCanonicalSubmission(db, { ...input, form: row.form, version: row.version });
}

export async function submitToExactVersion(
  db: FormsDatabase,
  input: {
    formId: string;
    versionNumber: number;
    workspaceId: string;
    answers: unknown;
    source?: "public_form" | "legacy_import";
    legacySubmissionId?: string;
    notes?: string | null;
    submittedAt?: Date;
    legacyFlagCodes?: string[];
    destinationOptions?: DestinationOptions;
    skipDeliveryAttempt?: boolean;
    submissionAttemptId?: string;
  },
) {
  const row = (
    await db
      .select({ form, version: formVersion })
      .from(form)
      .innerJoin(formVersion, eq(formVersion.formId, form.id))
      .where(
        and(
          eq(form.id, input.formId),
          eq(form.workspaceId, input.workspaceId),
          eq(formVersion.versionNumber, input.versionNumber),
        ),
      )
      .limit(1)
  )[0];
  if (!row) throw new FormServiceError("Form version not found.", 404);
  return persistCanonicalSubmission(db, { ...input, form: row.form, version: row.version });
}

export { ValidationError, FormServiceError };