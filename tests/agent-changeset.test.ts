import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { applyAgentChangeSet, proposeAgentTurn, rejectAgentChangeSet } from "@/lib/agent/service";
import type { FormAgentProvider } from "@/lib/agent/provider";
import { formVersion } from "@/lib/db/schema";
import { FormServiceError } from "@/lib/forms/errors";
import { createForm, getPublishedFormBySlug, getWorkspaceDraft, publishForm, updateDraft } from "@/lib/forms/service";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";

function providerWith(operations: unknown[], assistantMessage = "Proposed updates."): FormAgentProvider {
  return {
    async proposeChanges() {
      return { assistantMessage, operations: operations as never };
    },
  };
}

describe("agent change sets", () => {
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

  it("stores an informational reply without a change set", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const reply = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Critique this onboarding",
      provider: providerWith([], "The Health section is clear. Training repeats experience level."),
    });
    expect(reply.changeSet).toBeNull();
    expect(reply.message.content).toContain("Health section");
  });

  it("applies a valid proposal and increments revision", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const proposal = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Add a training section",
      provider: providerWith([{ type: "create_section", tempRef: "train", title: "Training" }]),
    });
    expect(proposal.changeSet?.baseDraftRevision).toBe(1);
    const applied = await applyAgentChangeSet(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      changeSetId: proposal.changeSet!.id,
    });
    expect(applied.draft.revision).toBe(2);
    expect(applied.draft.schema.sections.some((section) => section.title === "Training")).toBe(true);
    await expect(
      applyAgentChangeSet(db, {
        workspaceId: owner.workspaceId,
        formId: created.form.id,
        changeSetId: proposal.changeSet!.id,
      }),
    ).rejects.toBeInstanceOf(FormServiceError);
  });

  it("supersedes stale proposals and leaves the draft unchanged", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const proposal = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Add training",
      provider: providerWith([{ type: "create_section", tempRef: "train", title: "Training" }]),
    });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: created.draft.schema,
    });
    await expect(
      applyAgentChangeSet(db, {
        workspaceId: owner.workspaceId,
        formId: created.form.id,
        changeSetId: proposal.changeSet!.id,
      }),
    ).rejects.toBeInstanceOf(FormServiceError);
    const draft = await getWorkspaceDraft(db, owner.workspaceId, created.form.id);
    expect(draft.revision).toBe(2);
    expect(draft.schema.sections.some((section) => section.title === "Training")).toBe(false);
  });

  it("rejects without changing the draft", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const proposal = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Add training",
      provider: providerWith([{ type: "create_section", tempRef: "train", title: "Training" }]),
    });
    await rejectAgentChangeSet(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      changeSetId: proposal.changeSet!.id,
    });
    expect(created.draft.revision).toBe(1);
  });

  it("isolates change sets by workspace", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await createForm(db, { workspaceId: a.workspaceId, name: "Intake", source: "blank" });
    const proposal = await proposeAgentTurn(db, {
      workspaceId: a.workspaceId,
      formId: created.form.id,
      userId: a.userId,
      message: "Add training",
      provider: providerWith([{ type: "create_section", tempRef: "train", title: "Training" }]),
    });
    await expect(
      applyAgentChangeSet(db, {
        workspaceId: b.workspaceId,
        formId: created.form.id,
        changeSetId: proposal.changeSet!.id,
      }),
    ).rejects.toBeInstanceOf(FormServiceError);
  });

  it("never mutates a published FormVersion when applying to the draft", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const v1 = (await db.select().from(formVersion).where(eq(formVersion.formId, created.form.id)))[0];
    const proposal = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Add training",
      provider: providerWith([{ type: "create_section", tempRef: "train", title: "Training" }]),
    });
    await applyAgentChangeSet(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      changeSetId: proposal.changeSet!.id,
    });
    const still = (await db.select().from(formVersion).where(eq(formVersion.id, v1.id)))[0];
    expect(still.schema).toEqual(v1.schema);
    const published = await getPublishedFormBySlug(db, created.form.slug);
    expect(published?.versionNumber).toBe(1);
    expect(published?.schema.sections.some((section) => section.title === "Training")).toBe(false);
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const publicNow = await getPublishedFormBySlug(db, created.form.slug);
    expect(publicNow?.versionNumber).toBe(2);
  });

  it("applies a review rule proposal and blocks stale apply", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const proposal = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Add injury review",
      provider: providerWith([
        {
          type: "create_review_rule",
          label: "Name provided",
          conditions: { all: [{ fieldKey: "full_name", operator: "is_not_empty" }] },
          sourceFieldKeys: ["full_name"],
        },
      ]),
    });
    const applied = await applyAgentChangeSet(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      changeSetId: proposal.changeSet!.id,
    });
    expect(applied.draft.reviewRules?.rules).toHaveLength(1);
    const stale = await proposeAgentTurn(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
      message: "Add another rule",
      provider: providerWith([
        {
          type: "create_review_rule",
          label: "Email provided",
          conditions: { all: [{ fieldKey: "email", operator: "is_not_empty" }] },
          sourceFieldKeys: ["email"],
        },
      ]),
    });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: applied.draft.revision,
      schema: applied.draft.schema,
    });
    await expect(
      applyAgentChangeSet(db, {
        workspaceId: owner.workspaceId,
        formId: created.form.id,
        changeSetId: stale.changeSet!.id,
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/changed after/i) });
  });
});
