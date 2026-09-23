import { and, desc, eq } from "drizzle-orm";
import { agentChangeSet, agentMessage, agentThread, coachingProfile, formVersion } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { AgentProviderError } from "@/lib/ai/config";
import { getDeepSeekConfig } from "@/lib/ai/config";
import { FormServiceError } from "@/lib/forms/errors";
import { log } from "@/lib/observability/log";
import { getWorkspaceDraft, getWorkspaceForm, renameForm, updateDraft } from "@/lib/forms/service";
import { applyAgentOperations, formatChangeSummary, parseAgentOperations } from "./apply-operations";
import { AGENT_LIMITS } from "./limits";
import { createFormAgentProvider } from "./deepseek-provider";
import { clipAgentPrompt, type FormAgentProvider } from "./provider";

export async function getFormAgentThread(db: FormsDatabase, workspaceId: string, formId: string) {
  await getWorkspaceForm(db, workspaceId, formId);
  const rows = await db
    .select()
    .from(agentThread)
    .where(and(eq(agentThread.workspaceId, workspaceId), eq(agentThread.formId, formId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAgentMessages(db: FormsDatabase, workspaceId: string, threadId: string) {
  return db
    .select()
    .from(agentMessage)
    .where(and(eq(agentMessage.workspaceId, workspaceId), eq(agentMessage.threadId, threadId)))
    .orderBy(agentMessage.createdAt);
}

export async function getAgentChangeSet(db: FormsDatabase, workspaceId: string, formId: string, changeSetId: string) {
  const rows = await db
    .select()
    .from(agentChangeSet)
    .where(
      and(
        eq(agentChangeSet.id, changeSetId),
        eq(agentChangeSet.workspaceId, workspaceId),
        eq(agentChangeSet.formId, formId),
      ),
    )
    .limit(1);
  const record = rows[0];
  if (!record) throw new FormServiceError("Proposal not found.", 404);
  return record;
}

async function getOrCreateThread(
  db: FormsDatabase,
  input: { workspaceId: string; formId: string; userId: string },
) {
  const existing = await getFormAgentThread(db, input.workspaceId, input.formId);
  if (existing) return existing;
  const [created] = await db
    .insert(agentThread)
    .values({
      workspaceId: input.workspaceId,
      formId: input.formId,
      createdByUserId: input.userId,
      title: "Onboarding Agent",
    })
    .returning();
  return created;
}

export async function proposeAgentTurn(
  db: FormsDatabase,
  input: {
    workspaceId: string;
    formId: string;
    userId: string;
    message: string;
    provider?: FormAgentProvider;
  },
) {
  const message = clipAgentPrompt(input.message);
  if (!message) throw new FormServiceError("Write a message for the Agent.");
  const record = await getWorkspaceForm(db, input.workspaceId, input.formId);
  const draft = await getWorkspaceDraft(db, input.workspaceId, input.formId);
  const profiles = await db
    .select()
    .from(coachingProfile)
    .where(eq(coachingProfile.workspaceId, input.workspaceId))
    .limit(1);
  const profile = profiles[0];
  if (!profile) throw new FormServiceError("Complete your coaching profile first.");

  const thread = await getOrCreateThread(db, input);
  const history = await listAgentMessages(db, input.workspaceId, thread.id);
  await db.insert(agentMessage).values({
    workspaceId: input.workspaceId,
    threadId: thread.id,
    role: "user",
    content: message,
  });

  const provider = input.provider ?? createFormAgentProvider();
  let result;
  try {
    result = await provider.proposeChanges({
      message,
      profile,
      form: {
        id: record.id,
        name: record.name,
        status: record.status,
        revision: draft.revision,
        schema: draft.schema,
        clientIdentityMapping: draft.clientIdentityMapping ?? null,
        reviewRules: draft.reviewRules ?? null,
      },
      recentMessages: history.map((item) => ({ role: item.role, content: item.content })),
    });
  } catch (error) {
    log.error("agent_request_failed", { formId: input.formId, code: error instanceof AgentProviderError ? error.code : "unavailable" });
    await db.insert(agentMessage).values({
      workspaceId: input.workspaceId,
      threadId: thread.id,
      role: "assistant",
      content: "The Agent couldn't complete that request. Your form has not been changed.",
    });
    throw error instanceof AgentProviderError ? error : new AgentProviderError("unavailable");
  }

  let changeSetId: string | null = null;
  if (result.operations.length > 0) {
    try {
      const operations = parseAgentOperations(result.operations);
      const applied = applyAgentOperations({
        schema: draft.schema,
        clientIdentityMapping: draft.clientIdentityMapping ?? null,
        reviewRules: draft.reviewRules ?? null,
        operations,
      });
      const [created] = await db
        .insert(agentChangeSet)
        .values({
          workspaceId: input.workspaceId,
          formId: input.formId,
          threadId: thread.id,
          baseDraftRevision: draft.revision,
          status: "proposed",
          summary: formatChangeSummary(applied.changeSummary),
          operations,
          details: applied.changeSummary.details,
          provider: "deepseek",
          model: getDeepSeekConfig().model,
        })
        .returning();
      changeSetId = created.id;
      log.info("agent_changeset_created", { formId: input.formId, changeSetId: created.id });
    } catch (error) {
      log.error("agent_proposal_invalid", {
        formId: input.formId,
        reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      const [assistant] = await db
        .insert(agentMessage)
        .values({
          workspaceId: input.workspaceId,
          threadId: thread.id,
          role: "assistant",
          content:
            `${result.assistantMessage}\n\nI couldn't turn that into a safe draft change. Your form has not been changed.`.slice(
              0,
              AGENT_LIMITS.maxMessageChars * 2,
            ),
        })
        .returning();
      return { thread, message: assistant, changeSet: null };
    }
  }

  const [assistant] = await db
    .insert(agentMessage)
    .values({
      workspaceId: input.workspaceId,
      threadId: thread.id,
      role: "assistant",
      content: result.assistantMessage.slice(0, AGENT_LIMITS.maxMessageChars * 2),
      changeSetId,
    })
    .returning();

  const changeSet = changeSetId ? await getAgentChangeSet(db, input.workspaceId, input.formId, changeSetId) : null;
  return { thread, message: assistant, changeSet };
}

export async function applyAgentChangeSet(
  db: FormsDatabase,
  input: { workspaceId: string; formId: string; changeSetId: string },
) {
  return db.transaction(async (tx) => {
    const record = await getWorkspaceForm(tx as unknown as FormsDatabase, input.workspaceId, input.formId);
    const draft = await getWorkspaceDraft(tx as unknown as FormsDatabase, input.workspaceId, input.formId);
    const changeSet = await getAgentChangeSet(tx as unknown as FormsDatabase, input.workspaceId, input.formId, input.changeSetId);
    if (changeSet.status === "applied") throw new FormServiceError("Those changes are already applied.");
    if (changeSet.status === "rejected") throw new FormServiceError("Those changes were rejected.");
    if (changeSet.status !== "proposed" || changeSet.baseDraftRevision !== draft.revision) {
      await tx
        .update(agentChangeSet)
        .set({ status: "superseded" })
        .where(eq(agentChangeSet.id, changeSet.id));
      throw new FormServiceError("This form changed after the Agent created this proposal. Generate an updated proposal.");
    }
    const operations = parseAgentOperations(changeSet.operations);
    const applied = applyAgentOperations({
      schema: draft.schema,
      clientIdentityMapping: draft.clientIdentityMapping ?? null,
      reviewRules: draft.reviewRules ?? null,
      operations,
    });
    await updateDraft(tx as unknown as FormsDatabase, {
      workspaceId: input.workspaceId,
      formId: input.formId,
      expectedRevision: draft.revision,
      schema: applied.schema,
      clientIdentityMapping: applied.clientIdentityMapping,
      reviewRules: applied.reviewRules,
    });
    if (applied.formName && applied.formName !== record.name) {
      await renameForm(tx as unknown as FormsDatabase, input.workspaceId, input.formId, applied.formName);
    }
    await tx
      .update(agentChangeSet)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(agentChangeSet.id, changeSet.id));
    log.info("agent_changeset_applied", { formId: input.formId, changeSetId: changeSet.id });
    const nextDraft = await getWorkspaceDraft(tx as unknown as FormsDatabase, input.workspaceId, input.formId);
    const nextForm = await getWorkspaceForm(tx as unknown as FormsDatabase, input.workspaceId, input.formId);
    const versions = await tx
      .select({ id: formVersion.id, schema: formVersion.schema, versionNumber: formVersion.versionNumber })
      .from(formVersion)
      .where(eq(formVersion.formId, input.formId))
      .orderBy(desc(formVersion.versionNumber));
    return { draft: nextDraft, publishedVersions: versions, form: nextForm };
  });
}

export async function rejectAgentChangeSet(
  db: FormsDatabase,
  input: { workspaceId: string; formId: string; changeSetId: string },
) {
  const changeSet = await getAgentChangeSet(db, input.workspaceId, input.formId, input.changeSetId);
  if (changeSet.status !== "proposed") throw new FormServiceError("That proposal cannot be rejected.");
  const [updated] = await db
    .update(agentChangeSet)
    .set({ status: "rejected", rejectedAt: new Date() })
    .where(
      and(
        eq(agentChangeSet.id, changeSet.id),
        eq(agentChangeSet.workspaceId, input.workspaceId),
        eq(agentChangeSet.formId, input.formId),
      ),
    )
    .returning();
  return updated;
}
