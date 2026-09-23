import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { client, form, formVersion, submission } from "@/lib/db/schema";
import { resolveOrCreateClient } from "@/lib/clients/resolve";
import { getWorkspaceClient, getWorkspaceSubmission, listFormSubmissions } from "@/lib/clients/service";
import { FormServiceError } from "@/lib/forms/errors";
import { addField, updateField } from "@/lib/forms/schema-ops";
import { archiveForm, createForm, publishForm, updateDraft } from "@/lib/forms/service";
import { emptyAnswers, ValidationError } from "@/lib/onboarding/schema/engine";
import { persistCanonicalSubmission, submitPublishedForm } from "@/lib/submissions/service";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";

describe("client resolution and submissions", () => {
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

  it("creates a client when email is new", async () => {
    const owner = await seedWorkspace(db, "a");
    const first = await resolveOrCreateClient(db, owner.workspaceId, {
      fullName: "Ada",
      email: "Ada@Example.com",
      normalizedEmail: "ada@example.com",
      phone: "555",
    });
    expect(first.resolution).toBe("created");
    const second = await resolveOrCreateClient(db, owner.workspaceId, {
      fullName: "Ada Lovelace",
      email: " ada@example.com ",
      normalizedEmail: "ada@example.com",
      phone: "555",
    });
    expect(second.resolution).toBe("reused");
    expect(second.client.id).toBe(first.client.id);
    expect(second.client.fullName).toBe("Ada Lovelace");
  });

  it("does not merge when multiple email matches exist", async () => {
    const owner = await seedWorkspace(db, "a");
    await db.insert(client).values({
      workspaceId: owner.workspaceId,
      fullName: "One",
      email: "dup@example.com",
      normalizedEmail: "dup@example.com",
    });
    await db.insert(client).values({
      workspaceId: owner.workspaceId,
      fullName: "Two",
      email: "dup@example.com",
      normalizedEmail: "dup@example.com",
    });
    const result = await resolveOrCreateClient(db, owner.workspaceId, {
      fullName: "Three",
      email: "dup@example.com",
      normalizedEmail: "dup@example.com",
    });
    expect(result.resolution).toBe("ambiguous_created");
    const rows = await db.select().from(client);
    expect(rows).toHaveLength(3);
  });

  it("keeps the same email separate across workspaces", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const left = await resolveOrCreateClient(db, a.workspaceId, {
      fullName: "Ada",
      email: "ada@example.com",
      normalizedEmail: "ada@example.com",
    });
    const right = await resolveOrCreateClient(db, b.workspaceId, {
      fullName: "Ada",
      email: "ada@example.com",
      normalizedEmail: "ada@example.com",
    });
    expect(left.client.id).not.toBe(right.client.id);
  });

  async function publishBlank(workspaceId: string, userId: string, name = "Intake") {
    const created = await createForm(db, { workspaceId, name, source: "blank" });
    await publishForm(db, { workspaceId, formId: created.form.id, userId });
    return created;
  }

  function validBlankAnswers(schema: { sections: { fields: { key: string; type: string }[] }[] }) {
    const answers = emptyAnswers(schema as never);
    answers.full_name = "Test Client";
    answers.email = "client@example.com";
    answers.accuracy_acknowledgement = true;
    return answers;
  }

  it("stores a generic public submission", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await publishBlank(owner.workspaceId, owner.userId);
    const result = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: validBlankAnswers(created.draft.schema),
    });
    const rows = await db.select().from(submission);
    expect(rows).toHaveLength(1);
    expect(rows[0].formVersionId).toBe(result.formVersionId);
    expect(rows[0].answers).toMatchObject({ full_name: "Test Client" });
  });

  it("rejects unknown fields and required failures without creating clients", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await publishBlank(owner.workspaceId, owner.userId);
    await expect(
      submitPublishedForm(db, { slug: created.form.slug, answers: { ...validBlankAnswers(created.draft.schema), extra: "no" } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      submitPublishedForm(db, { slug: created.form.slug, answers: { ...validBlankAnswers(created.draft.schema), full_name: "" } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(client)).toHaveLength(0);
    expect(await db.select().from(submission)).toHaveLength(0);
  });

  it("rejects archived and unpublished forms", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Soon", source: "blank" });
    await expect(
      submitPublishedForm(db, { slug: created.form.slug, answers: validBlankAnswers(created.draft.schema) }),
    ).rejects.toBeInstanceOf(FormServiceError);
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await archiveForm(db, owner.workspaceId, created.form.id);
    await expect(
      submitPublishedForm(db, { slug: created.form.slug, answers: validBlankAnswers(created.draft.schema) }),
    ).rejects.toBeInstanceOf(FormServiceError);
  });

  it("keeps historical submissions on the original FormVersion", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await publishBlank(owner.workspaceId, owner.userId, "Versioned");
    const first = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: validBlankAnswers(created.draft.schema),
    });
    const nextSchema = {
      ...created.draft.schema,
      intro: { ...created.draft.schema.intro, title: "Welcome v2" },
    };
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: nextSchema,
    });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const second = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: { ...validBlankAnswers(created.draft.schema), email: "second@example.com" },
    });
    expect(first.versionNumber).toBe(1);
    expect(second.versionNumber).toBe(2);
    expect(first.formVersionId).not.toBe(second.formVersionId);
    const v1 = (await db.select().from(formVersion).where(eq(formVersion.id, first.formVersionId)))[0];
    expect((v1.schema as { intro: { title: string } }).intro.title).toBe("Welcome");
  });

  it("rejects publish without client identity mapping", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "No ID", source: "blank" });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: created.draft.schema,
      clientIdentityMapping: null,
    });
    await expect(
      publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId }),
    ).rejects.toBeInstanceOf(FormServiceError);
  });

  it("isolates client and submission reads by workspace", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await publishBlank(a.workspaceId, a.userId);
    const saved = await submitPublishedForm(db, {
      slug: created.form.slug,
      answers: validBlankAnswers(created.draft.schema),
    });
    const row = (await db.select().from(submission))[0];
    await expect(getWorkspaceClient(db, b.workspaceId, row.clientId)).rejects.toBeInstanceOf(FormServiceError);
    await expect(getWorkspaceSubmission(db, b.workspaceId, saved.submissionId)).rejects.toBeInstanceOf(FormServiceError);
    expect(await listFormSubmissions(db, b.workspaceId, created.form.id)).toHaveLength(0);
  });

  it("rejects invalid select values", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Select", source: "blank" });
    let schema = addField(created.draft.schema, created.draft.schema.sections[0].id, "single_select", "Color");
    const color = schema.sections[0].fields.find((field) => field.key === "color");
    if (!color) throw new Error("missing color field");
    schema = updateField(schema, color.id, { required: true });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema,
    });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await expect(
      submitPublishedForm(db, {
        slug: created.form.slug,
        answers: { ...validBlankAnswers(schema), color: "not-an-option" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not require a hidden conditional field", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Logic", source: "blank" });
    let schema = addField(created.draft.schema, created.draft.schema.sections[0].id, "boolean", "Has extra");
    schema = addField(schema, schema.sections[0].id, "short_text", "Extra details");
    const extra = schema.sections[0].fields.find((field) => field.key === "extra_details");
    const flag = schema.sections[0].fields.find((field) => field.key === "has_extra");
    if (!extra || !flag) throw new Error("missing logic fields");
    schema = updateField(schema, extra.id, {
      required: true,
      logic: { action: "show", all: [{ fieldKey: flag.key, operator: "equals", value: true }] },
    });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema,
    });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await expect(
      submitPublishedForm(db, {
        slug: created.form.slug,
        answers: { ...validBlankAnswers(schema), has_extra: false, extra_details: "" },
      }),
    ).resolves.toMatchObject({ versionNumber: 1 });
    await expect(
      submitPublishedForm(db, {
        slug: created.form.slug,
        answers: { ...validBlankAnswers(schema), email: "visible@example.com", has_extra: true, extra_details: "" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects missing published version, malformed schema, and bad identity mapping", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await publishBlank(owner.workspaceId, owner.userId, "Broken");
    const answers = validBlankAnswers(created.draft.schema);
    await db.update(form).set({ activePublishedVersionId: null }).where(eq(form.id, created.form.id));
    await expect(submitPublishedForm(db, { slug: created.form.slug, answers })).rejects.toBeInstanceOf(FormServiceError);

    const second = await publishBlank(owner.workspaceId, owner.userId, "Schema");
    const version = (await db.select().from(formVersion).where(eq(formVersion.formId, second.form.id)))[0];
    await db.update(formVersion).set({ schema: { nope: true } as never }).where(eq(formVersion.id, version.id));
    await expect(
      submitPublishedForm(db, { slug: second.form.slug, answers: validBlankAnswers(created.draft.schema) }),
    ).rejects.toBeInstanceOf(FormServiceError);

    const third = await publishBlank(owner.workspaceId, owner.userId, "Mapping");
    const mapped = (await db.select().from(formVersion).where(eq(formVersion.formId, third.form.id)))[0];
    await db.update(formVersion).set({ clientIdentityMapping: null }).where(eq(formVersion.id, mapped.id));
    await expect(
      submitPublishedForm(db, { slug: third.form.slug, answers: validBlankAnswers(created.draft.schema) }),
    ).rejects.toBeInstanceOf(FormServiceError);
    await db
      .update(formVersion)
      .set({ clientIdentityMapping: { fullNameFieldKey: "full_name", emailFieldKey: "full_name" } })
      .where(eq(formVersion.id, mapped.id));
    await expect(
      submitPublishedForm(db, { slug: third.form.slug, answers: validBlankAnswers(created.draft.schema) }),
    ).rejects.toBeInstanceOf(FormServiceError);
  });

  it("rolls back the client when submission insert fails", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await publishBlank(owner.workspaceId, owner.userId, "Tx");
    const row = (
      await db
        .select({ form, version: formVersion })
        .from(form)
        .innerJoin(formVersion, eq(formVersion.formId, form.id))
        .where(eq(form.id, created.form.id))
        .limit(1)
    )[0];
    await expect(
      persistCanonicalSubmission(db, {
        form: row.form,
        version: { ...row.version, id: "00000000-0000-4000-8000-000000000099" },
        answers: validBlankAnswers(created.draft.schema),
      }),
    ).rejects.toThrow();
    expect(await db.select().from(client)).toHaveLength(0);
    expect(await db.select().from(submission)).toHaveLength(0);
  });
});
