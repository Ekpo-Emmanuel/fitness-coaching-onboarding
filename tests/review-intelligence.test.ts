import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import validAnswers from "./fixtures/valid-client-answers.json";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";
import { markSubmissionReviewed } from "@/lib/clients/service";
import { form, formVersion, reviewFlag, submission, coachBrief } from "@/lib/db/schema";
import { addField } from "@/lib/forms/schema-ops";
import { createForm, publishForm, updateDraft } from "@/lib/forms/service";
import { EMPTY_REVIEW_RULES } from "@/lib/review/types";
import { generateCoachBrief, listReviewFlags } from "@/lib/intelligence/service";
import { buildCoachBriefInput, parseCoachBriefPayload } from "@/lib/intelligence/payload";
import { IntelligenceProviderError, type CoachBriefPayload } from "@/lib/intelligence/types";
import { emptyAnswers } from "@/lib/onboarding/schema/engine";
import { persistCanonicalSubmission, submitPublishedForm } from "@/lib/submissions/service";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";
import { FormServiceError } from "@/lib/forms/errors";

describe("phase 6 review intelligence", () => {
  let db: TestDb;
  let pg: PGlite;

  beforeAll(async () => {
    const created = await createTestDb();
    db = created.db;
    pg = created.client;
  });

  afterEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await pg.close();
  });

  function blankAnswers(schema: { sections: { fields: { key: string; type: string }[] }[] }) {
    const answers = emptyAnswers(schema as never);
    answers.full_name = "Test Client";
    answers.email = "client@example.com";
    answers.accuracy_acknowledgement = true;
    return answers;
  }

  function briefPayload(key: string): CoachBriefPayload {
    return {
      summary: { text: "The client completed onboarding.", sourceFieldKeys: [key] },
      goals: [],
      training: [],
    };
  }

  it("persists V1 flags atomically and leaves status new when nothing triggers", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, {
      workspaceId: owner.workspaceId,
      name: "V1",
      source: "v1",
      v1Schema: emmanuelOnboardingV1,
    });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const quiet = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: validAnswers,
    });
    expect(quiet.reviewStatus).toBe("new");
    expect(quiet.flagCount).toBe(0);
    const flagged = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: {
        ...validAnswers,
        email: "injury@example.com",
        current_injuries: "yes",
        current_injury_details: "Knee pain when squatting",
      },
    });
    expect(flagged.reviewStatus).toBe("needs_review");
    const flags = await listReviewFlags(db, owner.workspaceId, flagged.submissionId);
    expect(flags.map((flag) => flag.code)).toContain("current_injury_or_pain");
    await markSubmissionReviewed(db, owner.workspaceId, flagged.submissionId);
    expect((await listReviewFlags(db, owner.workspaceId, flagged.submissionId)).length).toBeGreaterThan(0);
  });

  it("rolls back the submission when flag insert fails", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Tx", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const row = (
      await db
        .select({ form, version: formVersion })
        .from(form)
        .innerJoin(formVersion, eq(formVersion.formId, form.id))
        .where(eq(form.id, created.form.id))
        .limit(1)
    )[0];
    await db
      .update(formVersion)
      .set({
        reviewRules: {
          version: "review_rules_v1",
          rules: [
            {
              id: "a",
              code: "same_code",
              label: "Current pain reported",
              conditions: { all: [{ fieldKey: "full_name", operator: "is_not_empty" }] },
              sourceFieldKeys: ["full_name"],
            },
            {
              id: "b",
              code: "same_code",
              label: "Name provided",
              conditions: { all: [{ fieldKey: "full_name", operator: "is_not_empty" }] },
              sourceFieldKeys: ["full_name"],
            },
          ],
        },
      })
      .where(eq(formVersion.id, row.version.id));
    const version = (await db.select().from(formVersion).where(eq(formVersion.id, row.version.id)))[0];
    await expect(
      persistCanonicalSubmission(db, { form: row.form, version, answers: blankAnswers(created.draft.schema) }),
    ).rejects.toThrow();
    expect(await db.select().from(submission)).toHaveLength(0);
    expect(await db.select().from(reviewFlag)).toHaveLength(0);
  });

  it("keeps historical flags when later versions change rules", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Pain", source: "blank" });
    const schema = addField(created.draft.schema, created.draft.schema.sections[0].id, "boolean", "Current pain");
    const pain = schema.sections[0].fields.find((field) => field.key === "current_pain");
    if (!pain) throw new Error("missing pain field");
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema,
      reviewRules: {
        version: "review_rules_v1",
        rules: [
          {
            id: "rule_a",
            code: "pain_reported",
            label: "Current pain reported",
            conditions: { all: [{ fieldKey: "current_pain", operator: "equals", value: true }] },
            sourceFieldKeys: ["current_pain"],
          },
        ],
      },
    });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const first = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: { ...blankAnswers(schema), current_pain: true },
    });
    const draft = await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 2,
      schema,
      reviewRules: {
        version: "review_rules_v1",
        rules: [
          {
            id: "rule_b",
            code: "name_review",
            label: "Name provided for review",
            conditions: { all: [{ fieldKey: "full_name", operator: "is_not_empty" }] },
            sourceFieldKeys: ["full_name"],
          },
        ],
      },
    });
    expect(draft.reviewRules?.rules[0].code).toBe("name_review");
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const second = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: { ...blankAnswers(schema), email: "two@example.com", current_pain: false },
    });
    const firstFlags = await listReviewFlags(db, owner.workspaceId, first.submissionId);
    const secondFlags = await listReviewFlags(db, owner.workspaceId, second.submissionId);
    expect(firstFlags.map((flag) => flag.code)).toEqual(["pain_reported"]);
    expect(secondFlags.map((flag) => flag.code)).toEqual(["name_review"]);
    expect(first.versionNumber).toBe(1);
    expect(second.versionNumber).toBe(2);
  });

  it("validates coach brief payloads and omits identity from model input", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await submitPublishedForm(db, { slug: created.form.slug, answers: blankAnswers(created.draft.schema) });
    const modelInput = buildCoachBriefInput({
      schema: created.draft.schema,
      answers: blankAnswers(created.draft.schema) as never,
      mapping: created.draft.clientIdentityMapping,
      reviewFlags: [],
      coaching: {
        providesNutritionCoaching: false,
        requiresHealthScreening: false,
        typicalGoals: [],
        typicalExperienceLevels: [],
      },
    });
    expect(modelInput.fields.some((field) => field.key === "email" || field.key === "full_name")).toBe(false);
    expect(JSON.stringify(modelInput)).not.toContain("client@example.com");
    expect(() => parseCoachBriefPayload({ summary: { text: "Hi", sourceFieldKeys: ["nope"] } }, created.draft.schema)).toThrow(
      IntelligenceProviderError,
    );
    expect(() => parseCoachBriefPayload({ extra: true, summary: { text: "Hi", sourceFieldKeys: ["accuracy_acknowledgement"] } }, created.draft.schema)).toThrow(
      IntelligenceProviderError,
    );
  });

  it("runs pending to complete, failed retry, and concurrent generation", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const result = await submitPublishedForm(db, { slug: created.form.slug, answers: blankAnswers(created.draft.schema) });
    const key = "accuracy_acknowledgement";
    const complete = await generateCoachBrief(db, {
      workspaceId: owner.workspaceId,
      submissionId: result.submissionId,
      provider: { async generateCoachBrief() { return briefPayload(key); } },
    });
    expect(complete.status).toBe("complete");
    const again = await generateCoachBrief(db, {
      workspaceId: owner.workspaceId,
      submissionId: result.submissionId,
      provider: { async generateCoachBrief() { throw new Error("should not run"); } },
    });
    expect(again.status).toBe("complete");

    const second = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: { ...blankAnswers(created.draft.schema), email: "retry@example.com" },
    });
    let fail = true;
    const failed = await generateCoachBrief(db, {
      workspaceId: owner.workspaceId,
      submissionId: second.submissionId,
      provider: {
        async generateCoachBrief() {
          if (fail) throw new IntelligenceProviderError("unavailable");
          return briefPayload(key);
        },
      },
    });
    expect(failed.status).toBe("failed");
    fail = false;
    const recovered = await generateCoachBrief(db, {
      workspaceId: owner.workspaceId,
      submissionId: second.submissionId,
      retry: true,
      provider: { async generateCoachBrief() { return briefPayload(key); } },
    });
    expect(recovered.status).toBe("complete");

    const third = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: { ...blankAnswers(created.draft.schema), email: "race@example.com" },
    });
    const [left, right] = await Promise.all([
      generateCoachBrief(db, {
        workspaceId: owner.workspaceId,
        submissionId: third.submissionId,
        provider: { async generateCoachBrief() { return briefPayload(key); } },
      }),
      generateCoachBrief(db, {
        workspaceId: owner.workspaceId,
        submissionId: third.submissionId,
        provider: { async generateCoachBrief() { return briefPayload(key); } },
      }),
    ]);
    expect([left.status, right.status].every((status) => status === "complete" || status === "processing")).toBe(true);
    const briefs = await db.select().from(coachBrief).where(eq(coachBrief.submissionId, third.submissionId));
    expect(briefs).toHaveLength(1);
  });

  it("blocks other workspaces from reading intelligence", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await createForm(db, { workspaceId: a.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: a.workspaceId, formId: created.form.id, userId: a.userId });
    const result = await submitPublishedForm(db, { slug: created.form.slug, answers: blankAnswers(created.draft.schema) });
    await expect(listReviewFlags(db, b.workspaceId, result.submissionId)).resolves.toEqual([]);
    await expect(
      generateCoachBrief(db, { workspaceId: b.workspaceId, submissionId: result.submissionId }),
    ).rejects.toBeInstanceOf(FormServiceError);
  });

  it("does not rewrite empty historical rules on a blank draft", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    expect(created.draft.reviewRules ?? EMPTY_REVIEW_RULES).toMatchObject({ rules: [] });
  });
});
