import { and, eq, or } from "drizzle-orm";
import { coachBrief, coachingProfile, reviewFlag } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { getCoachBriefModel } from "@/lib/ai/config";
import { getWorkspaceSubmission } from "@/lib/clients/service";
import { parseOnboardingSchema } from "@/lib/forms/parse-schema";
import { FormServiceError } from "@/lib/forms/errors";
import { log } from "@/lib/observability/log";
import { buildCoachBriefInput, parseCoachBriefPayload } from "./payload";
import { createSubmissionIntelligenceProvider } from "./deepseek-provider";
import type { SubmissionIntelligenceProvider } from "./types";
import { IntelligenceProviderError } from "./types";
import type { OnboardingAnswers } from "@/lib/onboarding/schema/types";

export async function listReviewFlags(db: FormsDatabase, workspaceId: string, submissionId: string) {
  return db
    .select()
    .from(reviewFlag)
    .where(and(eq(reviewFlag.workspaceId, workspaceId), eq(reviewFlag.submissionId, submissionId)));
}

export async function getCoachBrief(db: FormsDatabase, workspaceId: string, submissionId: string) {
  const rows = await db
    .select()
    .from(coachBrief)
    .where(and(eq(coachBrief.workspaceId, workspaceId), eq(coachBrief.submissionId, submissionId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function generateCoachBrief(
  db: FormsDatabase,
  input: {
    workspaceId: string;
    submissionId: string;
    retry?: boolean;
    provider?: SubmissionIntelligenceProvider;
  },
) {
  const loaded = await getWorkspaceSubmission(db, input.workspaceId, input.submissionId);
  const schema = parseOnboardingSchema(loaded.version.schema);
  let brief = await getCoachBrief(db, input.workspaceId, input.submissionId);
  if (!brief) {
    const [created] = await db
      .insert(coachBrief)
      .values({
        workspaceId: input.workspaceId,
        submissionId: input.submissionId,
        status: "pending",
      })
      .onConflictDoNothing({ target: coachBrief.submissionId })
      .returning();
    brief = created ?? (await getCoachBrief(db, input.workspaceId, input.submissionId));
  }
  if (!brief) throw new FormServiceError("Coach Brief could not be created.");
  if (brief.status === "complete" && !input.retry) return brief;
  if (brief.status === "processing") return brief;
  if (brief.status === "complete" && input.retry) {
    throw new FormServiceError("This brief is already complete.");
  }
  if (brief.status === "failed" && !input.retry) return brief;

  const [claimed] = await db
    .update(coachBrief)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(coachBrief.id, brief.id),
        eq(coachBrief.workspaceId, input.workspaceId),
        or(eq(coachBrief.status, "pending"), eq(coachBrief.status, "failed")),
      ),
    )
    .returning();
  if (!claimed) {
    return (await getCoachBrief(db, input.workspaceId, input.submissionId)) ?? brief;
  }

  const flags = await listReviewFlags(db, input.workspaceId, input.submissionId);
  const profiles = await db
    .select()
    .from(coachingProfile)
    .where(eq(coachingProfile.workspaceId, input.workspaceId))
    .limit(1);
  const profile = profiles[0];
  const modelInput = buildCoachBriefInput({
    schema,
    answers: loaded.submission.answers as OnboardingAnswers,
    mapping: loaded.version.clientIdentityMapping ?? null,
    reviewFlags: flags,
    coaching: {
      providesNutritionCoaching: profile?.providesNutritionCoaching ?? false,
      requiresHealthScreening: profile?.requiresHealthScreening ?? false,
      typicalGoals: profile?.typicalGoals ?? [],
      typicalExperienceLevels: profile?.typicalExperienceLevels ?? [],
    },
  });

  try {
    const provider = input.provider ?? createSubmissionIntelligenceProvider(schema);
    const payload = parseCoachBriefPayload(await provider.generateCoachBrief(modelInput), schema);
    const [complete] = await db
      .update(coachBrief)
      .set({
        status: "complete",
        payload,
        provider: "deepseek",
        model: getCoachBriefModel(),
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(coachBrief.id, claimed.id), eq(coachBrief.status, "processing")))
      .returning();
    return complete ?? claimed;
  } catch (error) {
    const code = error instanceof IntelligenceProviderError ? error.code : "unavailable";
    log.error("coach_brief_failed", { submissionId: input.submissionId, code });
    const [failed] = await db
      .update(coachBrief)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(coachBrief.id, claimed.id))
      .returning();
    return failed ?? claimed;
  }
}
