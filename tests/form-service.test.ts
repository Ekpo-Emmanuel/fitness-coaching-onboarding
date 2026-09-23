import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";
import { and, eq } from "drizzle-orm";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { DraftConflictError, FormServiceError } from "@/lib/forms/errors";
import {
  archiveForm,
  createForm,
  getPublishedFormBySlug,
  getWorkspaceDraft,
  getWorkspaceForm,
  publishForm,
  updateDraft,
} from "@/lib/forms/service";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";
import { formVersion } from "@/lib/db/schema";

describe("form service", () => {
  let db: TestDb;
  let client: PGlite;

  beforeAll(async () => {
    const created = await createTestDb();
    db = created.db;
    client = created.client;
  });

  afterEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates a form with one draft", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const draft = await getWorkspaceDraft(db, owner.workspaceId, created.form.id);
    expect(draft.revision).toBe(1);
    expect(created.form.slug).toMatch(/intake-/);
    expect(draft.clientIdentityMapping?.emailFieldKey).toBe("email");
  });

  it("isolates workspaces", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await createForm(db, { workspaceId: a.workspaceId, name: "Private", source: "blank" });
    await expect(getWorkspaceForm(db, b.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
    await expect(getWorkspaceDraft(db, b.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
    await expect(
      updateDraft(db, { workspaceId: b.workspaceId, formId: created.form.id, expectedRevision: 1, schema: created.draft.schema }),
    ).rejects.toBeInstanceOf(FormServiceError);
    await expect(publishForm(db, { workspaceId: b.workspaceId, formId: created.form.id, userId: b.userId })).rejects.toBeInstanceOf(
      FormServiceError,
    );
    await expect(archiveForm(db, b.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
  });

  it("publishes immutable versions", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, {
      workspaceId: owner.workspaceId,
      name: "V1 copy",
      source: "v1",
      v1Schema: emmanuelOnboardingV1,
    });
    const first = await publishForm(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
    });
    expect(first.version.versionNumber).toBe(1);
    const originalTitle = first.schema.title;
    const nextSchema = { ...created.draft.schema, title: "Edited draft" };
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: nextSchema,
    });
    const second = await publishForm(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
    });
    expect(second.version.versionNumber).toBe(2);
    const storedFirst = await db
      .select()
      .from(formVersion)
      .where(and(eq(formVersion.formId, created.form.id), eq(formVersion.versionNumber, 1)))
      .limit(1);
    expect(storedFirst[0]?.schema).toMatchObject({ title: originalTitle });
    const publicForm = await getPublishedFormBySlug(db, created.form.slug);
    expect(publicForm?.schema.title).toBe("Edited draft");
    expect(publicForm?.versionNumber).toBe(2);
    expect(first.version.id).not.toBe(second.version.id);
  });

  it("rejects stale draft revisions", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Rev", source: "blank" });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: created.draft.schema,
    });
    await expect(
      updateDraft(db, {
        workspaceId: owner.workspaceId,
        formId: created.form.id,
        expectedRevision: 1,
        schema: created.draft.schema,
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
  });

  it("archives forms out of the public route", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Live", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await archiveForm(db, owner.workspaceId, created.form.id);
    expect(await getPublishedFormBySlug(db, created.form.slug)).toBeNull();
  });

  it("keeps slugs unique", async () => {
    const owner = await seedWorkspace(db, "a");
    const first = await createForm(db, { workspaceId: owner.workspaceId, name: "Same Name", source: "blank" });
    const second = await createForm(db, { workspaceId: owner.workspaceId, name: "Same Name", source: "blank" });
    expect(first.form.slug).not.toBe(second.form.slug);
  });

  it("round-trips persisted schema JSON", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Blank", source: "blank" });
    const parsed = JSON.parse(JSON.stringify(created.draft.schema));
    expect(parsed.sections).toHaveLength(createBlankOnboardingSchema().sections.length);
  });
});
