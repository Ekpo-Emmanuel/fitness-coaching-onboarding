import { and, eq, inArray } from "drizzle-orm";
import {
  agentChangeSet,
  agentMessage,
  agentThread,
  auditEvent,
  client,
  coachBrief,
  coachingProfile,
  form,
  formDraft,
  formVersion,
  integration,
  integrationDelivery,
  reviewFlag,
  submission,
  workspace,
  workspaceMember,
} from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { getWorkspaceClient, getWorkspaceSubmission, listClientSubmissions } from "@/lib/clients/service";
import { FormServiceError } from "@/lib/forms/errors";
import { getWorkspaceForm } from "@/lib/forms/service";
import { decryptGoogleTokens, revokeGoogleTokens } from "@/lib/integrations/google-oauth";
import { log } from "@/lib/observability/log";
import { publicIntegration } from "@/lib/integrations/service";

export const EXTERNAL_DELETE_NOTICE =
  "This removes the data stored by this application. Copies previously sent to connected external destinations, such as Google Sheets or webhooks, may need to be removed there separately.";

export async function recordAudit(
  db: FormsDatabase,
  input: {
    workspaceId?: string | null;
    actorUserId?: string | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
  },
) {
  await db.insert(auditEvent).values({
    workspaceId: input.workspaceId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
  });
}

export async function exportClientJson(db: FormsDatabase, workspaceId: string, clientId: string) {
  const person = await getWorkspaceClient(db, workspaceId, clientId);
  const history = await listClientSubmissions(db, workspaceId, clientId);
  const submissions = [];
  for (const row of history) {
    const detail = await getWorkspaceSubmission(db, workspaceId, row.id);
    const flags = await db
      .select()
      .from(reviewFlag)
      .where(and(eq(reviewFlag.workspaceId, workspaceId), eq(reviewFlag.submissionId, row.id)));
    const briefs = await db
      .select()
      .from(coachBrief)
      .where(and(eq(coachBrief.workspaceId, workspaceId), eq(coachBrief.submissionId, row.id)));
    submissions.push({
      clientProvided: {
        answers: detail.submission.answers,
        submittedAt: detail.submission.submittedAt,
      },
      systemGenerated: {
        submissionId: detail.submission.id,
        formId: detail.form.id,
        formName: detail.form.name,
        formVersion: detail.version.versionNumber,
        reviewStatus: detail.submission.reviewStatus,
        notes: detail.submission.notes,
        reviewFlags: flags.map((flag) => ({
          code: flag.code,
          label: flag.label,
          sourceFieldKeys: flag.sourceFieldKeys,
        })),
      },
      aiGenerated: {
        coachBrief: briefs[0]?.payload ?? null,
        coachBriefStatus: briefs[0]?.status ?? null,
      },
    });
  }
  return {
    exportedAt: new Date().toISOString(),
    client: {
      id: person.id,
      fullName: person.fullName,
      email: person.email,
      phone: person.phone,
    },
    submissions,
  };
}

export async function exportFormSubmissionsCsv(db: FormsDatabase, workspaceId: string, formId: string) {
  await getWorkspaceForm(db, workspaceId, formId);
  const rows = await db
    .select({
      submission,
      client,
      versionNumber: formVersion.versionNumber,
    })
    .from(submission)
    .innerJoin(client, eq(client.id, submission.clientId))
    .innerJoin(formVersion, eq(formVersion.id, submission.formVersionId))
    .where(and(eq(submission.formId, formId), eq(submission.workspaceId, workspaceId)));
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.submission.answers ?? {})) keys.add(key);
  }
  const answerKeys = [...keys].sort();
  const header = [
    "submission_id",
    "submitted_at",
    "client_id",
    "client_name",
    "client_email",
    "form_version",
    "review_status",
    ...answerKeys,
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const answers = row.submission.answers ?? {};
    lines.push(
      [
        row.submission.id,
        row.submission.submittedAt.toISOString(),
        row.client.id,
        row.client.fullName,
        row.client.email,
        String(row.versionNumber),
        row.submission.reviewStatus,
        ...answerKeys.map((key) => cell(answers[key])),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function cell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export async function exportWorkspaceJson(db: FormsDatabase, workspaceId: string) {
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  if (!ws) throw new FormServiceError("Workspace not found.", 404);
  const profiles = await db.select().from(coachingProfile).where(eq(coachingProfile.workspaceId, workspaceId));
  const forms = await db.select().from(form).where(eq(form.workspaceId, workspaceId));
  const versions = await db.select().from(formVersion).where(eq(formVersion.workspaceId, workspaceId));
  const clients = await db.select().from(client).where(eq(client.workspaceId, workspaceId));
  const submissions = await db.select().from(submission).where(eq(submission.workspaceId, workspaceId));
  const flags = await db.select().from(reviewFlag).where(eq(reviewFlag.workspaceId, workspaceId));
  const briefs = await db.select().from(coachBrief).where(eq(coachBrief.workspaceId, workspaceId));
  const integrations = await db.select().from(integration).where(eq(integration.workspaceId, workspaceId));
  return {
    exportedAt: new Date().toISOString(),
    workspace: { id: ws.id, name: ws.name },
    coachingProfile: profiles[0]
      ? {
          businessName: profiles[0].businessName,
          coachName: profiles[0].coachName,
          targetClientDescription: profiles[0].targetClientDescription,
        }
      : null,
    forms: forms.map((item) => ({ id: item.id, name: item.name, slug: item.slug, status: item.status })),
    formVersions: versions.map((item) => ({
      id: item.id,
      formId: item.formId,
      versionNumber: item.versionNumber,
      schema: item.schema,
      reviewRules: item.reviewRules,
    })),
    clients: clients.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      phone: item.phone,
    })),
    submissions: submissions.map((item) => ({
      id: item.id,
      clientId: item.clientId,
      formId: item.formId,
      formVersionId: item.formVersionId,
      answers: item.answers,
      reviewStatus: item.reviewStatus,
      notes: item.notes,
      submittedAt: item.submittedAt,
    })),
    reviewFlags: flags.map((item) => ({
      submissionId: item.submissionId,
      code: item.code,
      label: item.label,
      sourceFieldKeys: item.sourceFieldKeys,
    })),
    coachBriefs: briefs.map((item) => ({
      submissionId: item.submissionId,
      status: item.status,
      payload: item.payload,
    })),
    integrations: integrations.map((item) => publicIntegration(item)),
  };
}

export async function deleteClientData(
  db: FormsDatabase,
  workspaceId: string,
  clientId: string,
  actorUserId: string,
) {
  const person = await getWorkspaceClient(db, workspaceId, clientId);
  const subs = await db
    .select({ id: submission.id })
    .from(submission)
    .where(and(eq(submission.workspaceId, workspaceId), eq(submission.clientId, clientId)));
  const ids = subs.map((item) => item.id);
  await db.transaction(async (tx) => {
    if (ids.length) {
      await tx
        .delete(integrationDelivery)
        .where(and(eq(integrationDelivery.workspaceId, workspaceId), inArray(integrationDelivery.submissionId, ids)));
      await tx.delete(coachBrief).where(and(eq(coachBrief.workspaceId, workspaceId), inArray(coachBrief.submissionId, ids)));
      await tx.delete(reviewFlag).where(and(eq(reviewFlag.workspaceId, workspaceId), inArray(reviewFlag.submissionId, ids)));
      await tx.delete(submission).where(and(eq(submission.workspaceId, workspaceId), eq(submission.clientId, clientId)));
    }
    await tx.delete(client).where(and(eq(client.id, person.id), eq(client.workspaceId, workspaceId)));
  });
  await recordAudit(db, {
    workspaceId,
    actorUserId,
    action: "client_data_deletion_completed",
    resourceType: "client",
    resourceId: clientId,
  });
  log.info("client_deleted", { workspaceId, clientId });
  return { ok: true as const, notice: EXTERNAL_DELETE_NOTICE };
}

export async function deleteWorkspaceData(db: FormsDatabase, workspaceId: string, actorUserId: string, role: string) {
  if (role !== "owner") throw new FormServiceError("Only the workspace owner can delete this workspace.", 403);
  const integrations = await db.select().from(integration).where(eq(integration.workspaceId, workspaceId));
  for (const item of integrations) {
    if (item.type === "google_sheets" && item.encryptedCredentials) {
      try {
        await revokeGoogleTokens(decryptGoogleTokens(item.encryptedCredentials));
      } catch {
        log.warn("google_revoke_failed", { integrationId: item.id });
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(integrationDelivery).where(eq(integrationDelivery.workspaceId, workspaceId));
    await tx.delete(integration).where(eq(integration.workspaceId, workspaceId));
    await tx.delete(agentMessage).where(eq(agentMessage.workspaceId, workspaceId));
    await tx.delete(agentChangeSet).where(eq(agentChangeSet.workspaceId, workspaceId));
    await tx.delete(agentThread).where(eq(agentThread.workspaceId, workspaceId));
    await tx.delete(coachBrief).where(eq(coachBrief.workspaceId, workspaceId));
    await tx.delete(reviewFlag).where(eq(reviewFlag.workspaceId, workspaceId));
    await tx.delete(submission).where(eq(submission.workspaceId, workspaceId));
    await tx.delete(client).where(eq(client.workspaceId, workspaceId));
    await tx.update(form).set({ activePublishedVersionId: null }).where(eq(form.workspaceId, workspaceId));
    await tx.delete(formDraft).where(eq(formDraft.workspaceId, workspaceId));
    await tx.delete(formVersion).where(eq(formVersion.workspaceId, workspaceId));
    await tx.delete(form).where(eq(form.workspaceId, workspaceId));
    await tx.delete(coachingProfile).where(eq(coachingProfile.workspaceId, workspaceId));
    await tx.delete(workspaceMember).where(eq(workspaceMember.workspaceId, workspaceId));
    await tx.delete(workspace).where(eq(workspace.id, workspaceId));
  });
  await recordAudit(db, {
    actorUserId,
    action: "workspace_deletion_initiated",
    resourceType: "workspace",
    resourceId: workspaceId,
  });
  log.info("workspace_deleted", { workspaceId });
  return { ok: true as const, notice: EXTERNAL_DELETE_NOTICE };
}
