import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { getPoolDb } from "../lib/db/node";
import { formVersion, reviewFlag, submission } from "../lib/db/schema";
import { parseOnboardingSchema } from "../lib/forms/parse-schema";
import { evaluateReviewRules } from "../lib/review/evaluate";
import { parseReviewRuleSet } from "../lib/review/validate";
import type { OnboardingAnswers } from "../lib/onboarding/schema/types";

loadEnvConfig(process.cwd());

/**
 * Idempotent backfill of ReviewFlags for submissions whose FormVersion has a ReviewRuleSet.
 * Does not run on application startup. Does not change reviewed status except new -> needs_review.
 * Usage: npm run backfill:review-flags -- --workspace=<id>
 */
async function main() {
  const prefix = "--workspace=";
  const workspaceId = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!workspaceId) throw new Error("Pass --workspace=<workspace id>.");
  const db = getPoolDb();
  const rows = await db
    .select({ submission, version: formVersion })
    .from(submission)
    .innerJoin(formVersion, eq(formVersion.id, submission.formVersionId))
    .where(eq(submission.workspaceId, workspaceId));
  let created = 0;
  for (const row of rows) {
    const rules = parseReviewRuleSet(row.version.reviewRules);
    if (!rules?.rules.length) continue;
    const existing = await db
      .select({ id: reviewFlag.id })
      .from(reviewFlag)
      .where(and(eq(reviewFlag.submissionId, row.submission.id), eq(reviewFlag.workspaceId, workspaceId)))
      .limit(1);
    if (existing[0]) continue;
    const schema = parseOnboardingSchema(row.version.schema);
    const flags = evaluateReviewRules({
      rules,
      answers: row.submission.answers as OnboardingAnswers,
      schema,
    });
    if (!flags.length) continue;
    await db.insert(reviewFlag).values(
      flags.map((flag) => ({
        workspaceId,
        submissionId: row.submission.id,
        ruleId: flag.ruleId,
        code: flag.code,
        label: flag.label,
        sourceFieldKeys: flag.sourceFieldKeys,
      })),
    );
    if (row.submission.reviewStatus === "new") {
      await db
        .update(submission)
        .set({ reviewStatus: "needs_review" })
        .where(eq(submission.id, row.submission.id));
    }
    created += flags.length;
  }
  console.info(`Backfilled ${created} review flags.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
