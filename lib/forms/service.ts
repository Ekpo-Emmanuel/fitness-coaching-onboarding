import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { form, formDraft, formVersion } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import { createBlankOnboardingSchema } from "./blank-schema";
import { SCHEMA_FORMAT_VERSION } from "./constants";
import { DraftConflictError, FormServiceError } from "./errors";
import {
  assertCollectibleMapping,
  defaultIdentityMapping,
  isCollectibleMapping,
  V1_IDENTITY_MAPPING,
  type ClientIdentityMapping,
} from "./identity";
import { parseOnboardingSchema } from "./parse-schema";
import { createFormSlug } from "./slug";
import { isLegacyV1Schema } from "./legacy";
import { EMPTY_REVIEW_RULES, type ReviewRuleSet } from "@/lib/review/types";
import { assertReviewRuleSet, parseReviewRuleSet } from "@/lib/review/validate";
import { V1_REVIEW_RULES } from "@/lib/review/v1-rules";

export type PublicFormBranding = {
  businessName: string;
  coachName: string;
  primaryColor: string | null;
};

function bindSchemaToForm(schema: OnboardingSchema, formId: string, title: string): OnboardingSchema {
  return parseOnboardingSchema({
    ...structuredClone(schema),
    title: schema.title || title,
    storageKey: `form_${formId}`,
  });
}

async function uniqueSlug(db: FormsDatabase, name: string, preferred?: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = preferred && attempt === 0 ? preferred : createFormSlug(name);
    const existing = await db.select({ id: form.id }).from(form).where(eq(form.slug, slug)).limit(1);
    if (existing.length === 0) return slug;
  }
  throw new FormServiceError("Could not allocate a public URL. Try a different name.");
}

export async function listForms(db: FormsDatabase, workspaceId: string) {
  return db
    .select({
      id: form.id,
      name: form.name,
      slug: form.slug,
      status: form.status,
      updatedAt: form.updatedAt,
      versionNumber: formVersion.versionNumber,
    })
    .from(form)
    .leftJoin(formVersion, eq(form.activePublishedVersionId, formVersion.id))
    .where(and(eq(form.workspaceId, workspaceId), ne(form.status, "archived")))
    .orderBy(desc(form.updatedAt));
}

export async function getWorkspaceForm(db: FormsDatabase, workspaceId: string, formId: string) {
  const rows = await db
    .select()
    .from(form)
    .where(and(eq(form.id, formId), eq(form.workspaceId, workspaceId)))
    .limit(1);
  const record = rows[0];
  if (!record) throw new FormServiceError("Form not found.", 404);
  return record;
}

export async function getWorkspaceDraft(db: FormsDatabase, workspaceId: string, formId: string) {
  await getWorkspaceForm(db, workspaceId, formId);
  const rows = await db
    .select()
    .from(formDraft)
    .where(and(eq(formDraft.formId, formId), eq(formDraft.workspaceId, workspaceId)))
    .limit(1);
  const record = rows[0];
  if (!record) throw new FormServiceError("Draft not found.", 404);
  return {
    ...record,
    schema: parseOnboardingSchema(record.schema),
    reviewRules: record.reviewRules ? parseReviewRuleSet(record.reviewRules) : null,
  };
}

export async function listWorkspaceVersions(db: FormsDatabase, workspaceId: string, formId: string) {
  await getWorkspaceForm(db, workspaceId, formId);
  return db
    .select({
      id: formVersion.id,
      versionNumber: formVersion.versionNumber,
      publishedAt: formVersion.publishedAt,
      publishedByUserId: formVersion.publishedByUserId,
      schemaFormatVersion: formVersion.schemaFormatVersion,
    })
    .from(formVersion)
    .where(and(eq(formVersion.formId, formId), eq(formVersion.workspaceId, workspaceId)))
    .orderBy(desc(formVersion.versionNumber));
}

export async function createForm(
  db: FormsDatabase,
  input: {
    workspaceId: string;
    name: string;
    source: "blank" | "v1";
    v1Schema?: OnboardingSchema;
  },
) {
  const name = input.name.trim();
  if (name.length < 2) throw new FormServiceError("Give the onboarding a name.");
  const slug = await uniqueSlug(db, name);
  const sourceSchema =
    input.source === "v1"
      ? parseOnboardingSchema(structuredClone(input.v1Schema))
      : createBlankOnboardingSchema(name);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(form)
      .values({
        workspaceId: input.workspaceId,
        name,
        slug,
        status: "draft",
      })
      .returning();
    const schema = bindSchemaToForm(sourceSchema, created.id, name);
    const mapping = input.source === "v1" ? V1_IDENTITY_MAPPING : defaultIdentityMapping(schema);
    const reviewRules = input.source === "v1" ? V1_REVIEW_RULES : EMPTY_REVIEW_RULES;
    const [draft] = await tx
      .insert(formDraft)
      .values({
        workspaceId: input.workspaceId,
        formId: created.id,
        schema,
        clientIdentityMapping: mapping,
        reviewRules,
        revision: 1,
      })
      .returning();
    return { form: created, draft: { ...draft, schema } };
  });
}

export async function renameForm(db: FormsDatabase, workspaceId: string, formId: string, name: string) {
  const nextName = name.trim();
  if (nextName.length < 2) throw new FormServiceError("Give the onboarding a name.");
  await getWorkspaceForm(db, workspaceId, formId);
  const [updated] = await db
    .update(form)
    .set({ name: nextName, updatedAt: new Date() })
    .where(and(eq(form.id, formId), eq(form.workspaceId, workspaceId)))
    .returning();
  return updated;
}

export async function updateDraft(
  db: FormsDatabase,
  input: {
    workspaceId: string;
    formId: string;
    expectedRevision: number;
    schema: unknown;
    clientIdentityMapping?: ClientIdentityMapping | null;
    reviewRules?: ReviewRuleSet | null;
  },
) {
  const schema = parseOnboardingSchema(input.schema);
  const current = await getWorkspaceDraft(db, input.workspaceId, input.formId);
  if (current.revision !== input.expectedRevision) {
    throw new DraftConflictError(current.revision);
  }
  const mapping =
    input.clientIdentityMapping === undefined ? current.clientIdentityMapping : input.clientIdentityMapping;
  const reviewRules =
    input.reviewRules === undefined ? current.reviewRules : parseReviewRuleSet(input.reviewRules);
  assertReviewRuleSet(schema, reviewRules);
  const [updated] = await db
    .update(formDraft)
    .set({
      schema,
      clientIdentityMapping: mapping,
      reviewRules,
      revision: current.revision + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(formDraft.id, current.id), eq(formDraft.revision, input.expectedRevision)))
    .returning();
  if (!updated) throw new DraftConflictError(current.revision);
  await db.update(form).set({ updatedAt: new Date() }).where(eq(form.id, input.formId));
  return {
    ...updated,
    schema: parseOnboardingSchema(updated.schema),
    reviewRules: updated.reviewRules ? parseReviewRuleSet(updated.reviewRules) : null,
  };
}

export async function publishForm(
  db: FormsDatabase,
  input: { workspaceId: string; formId: string; userId: string },
) {
  return db.transaction(async (tx) => {
    const formRows = await tx
      .select()
      .from(form)
      .where(and(eq(form.id, input.formId), eq(form.workspaceId, input.workspaceId)))
      .limit(1);
    const record = formRows[0];
    if (!record) throw new FormServiceError("Form not found.", 404);
    if (record.status === "archived") throw new FormServiceError("Archived onboardings cannot be published.");

    const draftRows = await tx
      .select()
      .from(formDraft)
      .where(and(eq(formDraft.formId, input.formId), eq(formDraft.workspaceId, input.workspaceId)))
      .limit(1);
    const draft = draftRows[0];
    if (!draft) throw new FormServiceError("Draft not found.", 404);
    const schema = parseOnboardingSchema(draft.schema);
    const mapping = assertCollectibleMapping(schema, draft.clientIdentityMapping);
    const reviewRules = parseReviewRuleSet(draft.reviewRules);
    assertReviewRuleSet(schema, reviewRules);

    const latest = await tx
      .select({ versionNumber: formVersion.versionNumber })
      .from(formVersion)
      .where(eq(formVersion.formId, input.formId))
      .orderBy(desc(formVersion.versionNumber))
      .limit(1);
    const versionNumber = (latest[0]?.versionNumber ?? 0) + 1;

    const [createdVersion] = await tx
      .insert(formVersion)
      .values({
        workspaceId: input.workspaceId,
        formId: input.formId,
        versionNumber,
        schema,
        schemaFormatVersion: SCHEMA_FORMAT_VERSION,
        clientIdentityMapping: mapping,
        reviewRules,
        publishedByUserId: input.userId,
      })
      .returning();

    const [published] = await tx
      .update(form)
      .set({
        status: "published",
        activePublishedVersionId: createdVersion.id,
        updatedAt: new Date(),
      })
      .where(eq(form.id, input.formId))
      .returning();

    return { form: published, version: createdVersion, schema };
  });
}

export async function archiveForm(db: FormsDatabase, workspaceId: string, formId: string) {
  await getWorkspaceForm(db, workspaceId, formId);
  const [updated] = await db
    .update(form)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(form.id, formId), eq(form.workspaceId, workspaceId)))
    .returning();
  return updated;
}

export async function getPublishedFormBySlug(db: FormsDatabase, slug: string) {
  const rows = await db
    .select({
      form,
      version: formVersion,
    })
    .from(form)
    .innerJoin(formVersion, eq(form.activePublishedVersionId, formVersion.id))
    .where(eq(form.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row || row.form.status !== "published") return null;
  const schema = parseOnboardingSchema(row.version.schema);
  return {
    workspaceId: row.form.workspaceId,
    formId: row.form.id,
    formVersionId: row.version.id,
    name: row.form.name,
    slug: row.form.slug,
    versionNumber: row.version.versionNumber,
    schema,
    canCollect: isCollectibleMapping(schema, row.version.clientIdentityMapping),
  };
}

export async function seedV1Form(
  db: FormsDatabase,
  input: {
    workspaceId: string;
    userId: string;
    schema: OnboardingSchema;
    name?: string;
    slug?: string;
  },
) {
  const name = input.name ?? "Client Onboarding";
  const preferredSlug = input.slug ?? "emmanuel-onboarding";
  const existing = await db
    .select()
    .from(form)
    .where(and(eq(form.workspaceId, input.workspaceId), eq(form.slug, preferredSlug)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(formDraft)
      .set({ clientIdentityMapping: V1_IDENTITY_MAPPING })
      .where(
        and(
          eq(formDraft.formId, existing[0].id),
          eq(formDraft.workspaceId, input.workspaceId),
          isNull(formDraft.clientIdentityMapping),
        ),
      );
    await db
      .update(formVersion)
      .set({ clientIdentityMapping: V1_IDENTITY_MAPPING })
      .where(
        and(
          eq(formVersion.formId, existing[0].id),
          eq(formVersion.workspaceId, input.workspaceId),
          isNull(formVersion.clientIdentityMapping),
        ),
      );
    await backfillV1ReviewRules(db, input.workspaceId, existing[0].id);
    const versions = await listWorkspaceVersions(db, input.workspaceId, existing[0].id);
    return { form: existing[0], created: false, versions };
  }
  const slug = await uniqueSlug(db, name, preferredSlug);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(form)
      .values({
        workspaceId: input.workspaceId,
        name,
        slug,
        status: "draft",
      })
      .returning();
    const schema = bindSchemaToForm(parseOnboardingSchema(structuredClone(input.schema)), created.id, name);
    await tx.insert(formDraft).values({
      workspaceId: input.workspaceId,
      formId: created.id,
      schema,
      clientIdentityMapping: V1_IDENTITY_MAPPING,
      reviewRules: V1_REVIEW_RULES,
      revision: 1,
    });
    const [version] = await tx
      .insert(formVersion)
      .values({
        workspaceId: input.workspaceId,
        formId: created.id,
        versionNumber: 1,
        schema,
        schemaFormatVersion: SCHEMA_FORMAT_VERSION,
        clientIdentityMapping: V1_IDENTITY_MAPPING,
        reviewRules: V1_REVIEW_RULES,
        publishedByUserId: input.userId,
      })
      .returning();
    const [published] = await tx
      .update(form)
      .set({
        status: "published",
        activePublishedVersionId: version.id,
        updatedAt: new Date(),
      })
      .where(eq(form.id, created.id))
      .returning();
    return { form: published, created: true, versions: [version] };
  });
}

async function backfillV1ReviewRules(db: FormsDatabase, workspaceId: string, formId: string) {
  const drafts = await db
    .select()
    .from(formDraft)
    .where(and(eq(formDraft.formId, formId), eq(formDraft.workspaceId, workspaceId)))
    .limit(1);
  const draft = drafts[0];
  if (draft && !draft.reviewRules) {
    try {
      const schema = parseOnboardingSchema(draft.schema);
      if (isLegacyV1Schema(schema)) {
        await db
          .update(formDraft)
          .set({ reviewRules: V1_REVIEW_RULES })
          .where(and(eq(formDraft.id, draft.id), isNull(formDraft.reviewRules)));
      }
    } catch {
      // Keep the existing draft if the snapshot cannot be parsed.
    }
  }
  const versions = await db
    .select()
    .from(formVersion)
    .where(and(eq(formVersion.formId, formId), eq(formVersion.workspaceId, workspaceId)));
  for (const version of versions) {
    if (version.reviewRules) continue;
    try {
      const schema = parseOnboardingSchema(version.schema);
      if (!isLegacyV1Schema(schema)) continue;
      await db
        .update(formVersion)
        .set({ reviewRules: V1_REVIEW_RULES })
        .where(and(eq(formVersion.id, version.id), isNull(formVersion.reviewRules)));
    } catch {
      // Leave historical versions untouched when schema parse fails.
    }
  }
}
