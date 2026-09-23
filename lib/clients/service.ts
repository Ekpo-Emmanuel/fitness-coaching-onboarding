import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { client, form, formVersion, submission } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";

const PAGE_SIZE = 50;

export async function listClients(
  db: FormsDatabase,
  workspaceId: string,
  query?: string,
  status?: "new" | "needs_review" | "reviewed",
) {
  const term = query?.trim().slice(0, 80);
  const filters = [eq(client.workspaceId, workspaceId)];
  if (term) {
    const like = `%${term}%`;
    filters.push(or(ilike(client.fullName, like), ilike(client.email, like))!);
  }
  const people = await db
    .select({
      id: client.id,
      fullName: client.fullName,
      email: client.email,
      phone: client.phone,
      updatedAt: client.updatedAt,
    })
    .from(client)
    .where(and(...filters))
    .orderBy(desc(client.updatedAt))
    .limit(PAGE_SIZE);

  const latest = people.length
    ? await db
        .select({
          clientId: submission.clientId,
          submittedAt: submission.submittedAt,
          reviewStatus: submission.reviewStatus,
          formName: form.name,
        })
        .from(submission)
        .innerJoin(form, eq(form.id, submission.formId))
        .where(and(eq(submission.workspaceId, workspaceId), inArray(submission.clientId, people.map((item) => item.id))))
        .orderBy(desc(submission.submittedAt))
    : [];

  const rows = people.map((person) => {
    const recent = latest.find((row) => row.clientId === person.id);
    return {
      client: person,
      latestSubmittedAt: recent?.submittedAt ?? null,
      latestFormName: recent?.formName ?? null,
      latestReviewStatus: recent?.reviewStatus ?? null,
    };
  });
  if (!status) return rows;
  return rows.filter((row) => row.latestReviewStatus === status);
}

export async function getWorkspaceClient(db: FormsDatabase, workspaceId: string, clientId: string) {
  const rows = await db
    .select()
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.workspaceId, workspaceId)))
    .limit(1);
  const record = rows[0];
  if (!record) throw new FormServiceError("Client not found.", 404);
  return record;
}

export async function listClientSubmissions(db: FormsDatabase, workspaceId: string, clientId: string) {
  await getWorkspaceClient(db, workspaceId, clientId);
  return db
    .select({
      id: submission.id,
      submittedAt: submission.submittedAt,
      reviewStatus: submission.reviewStatus,
      formName: form.name,
      versionNumber: formVersion.versionNumber,
    })
    .from(submission)
    .innerJoin(form, eq(form.id, submission.formId))
    .innerJoin(formVersion, eq(formVersion.id, submission.formVersionId))
    .where(and(eq(submission.clientId, clientId), eq(submission.workspaceId, workspaceId)))
    .orderBy(desc(submission.submittedAt))
    .limit(50);
}

export async function listFormSubmissions(
  db: FormsDatabase,
  workspaceId: string,
  formId: string,
  status?: "new" | "needs_review" | "reviewed",
) {
  const rows = await db
    .select({
      id: submission.id,
      submittedAt: submission.submittedAt,
      reviewStatus: submission.reviewStatus,
      clientId: client.id,
      fullName: client.fullName,
      versionNumber: formVersion.versionNumber,
    })
    .from(submission)
    .innerJoin(client, eq(client.id, submission.clientId))
    .innerJoin(formVersion, eq(formVersion.id, submission.formVersionId))
    .where(and(eq(submission.formId, formId), eq(submission.workspaceId, workspaceId)))
    .orderBy(desc(submission.submittedAt))
    .limit(50);
  const mapped = rows.map((row) => ({
    submission: { id: row.id, submittedAt: row.submittedAt, reviewStatus: row.reviewStatus },
    client: { id: row.clientId, fullName: row.fullName },
    versionNumber: row.versionNumber,
  }));
  if (!status) return mapped;
  return mapped.filter((row) => row.submission.reviewStatus === status);
}

export async function getWorkspaceSubmission(db: FormsDatabase, workspaceId: string, submissionId: string) {
  const rows = await db
    .select({
      submission,
      client,
      form,
      version: formVersion,
    })
    .from(submission)
    .innerJoin(client, eq(client.id, submission.clientId))
    .innerJoin(form, eq(form.id, submission.formId))
    .innerJoin(formVersion, eq(formVersion.id, submission.formVersionId))
    .where(and(eq(submission.id, submissionId), eq(submission.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new FormServiceError("Submission not found.", 404);
  return row;
}

export async function markSubmissionReviewed(db: FormsDatabase, workspaceId: string, submissionId: string) {
  await getWorkspaceSubmission(db, workspaceId, submissionId);
  const [updated] = await db
    .update(submission)
    .set({ reviewStatus: "reviewed" })
    .where(and(eq(submission.id, submissionId), eq(submission.workspaceId, workspaceId)))
    .returning();
  return updated;
}
