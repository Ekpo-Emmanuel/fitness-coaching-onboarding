"use server";

import { getPoolDb } from "@/lib/db/node";
import { DraftConflictError, FormServiceError, SchemaParseError } from "@/lib/forms/errors";
import { archiveForm, createForm, publishForm, renameForm, updateDraft } from "@/lib/forms/service";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";
import { requireWorkspace } from "@/lib/workspace/session";

function asError(error: unknown) {
  if (error instanceof DraftConflictError) {
    return { error: error.message, conflict: true as const, currentRevision: error.currentRevision };
  }
  if (error instanceof SchemaParseError) {
    return { error: error.message, issues: error.issues };
  }
  if (error instanceof FormServiceError) {
    return { error: error.message };
  }
  return { error: "Could not save the onboarding." };
}

export async function createFormAction(input: { name: string; source: "blank" | "v1" }) {
  const { workspace } = await requireWorkspace();
  try {
    const created = await createForm(getPoolDb(), {
      workspaceId: workspace.id,
      name: input.name,
      source: input.source,
      v1Schema: input.source === "v1" ? emmanuelOnboardingV1 : undefined,
    });
    return { ok: true as const, formId: created.form.id };
  } catch (error) {
    return asError(error);
  }
}

export async function renameFormAction(formId: string, name: string) {
  const { workspace } = await requireWorkspace();
  try {
    await renameForm(getPoolDb(), workspace.id, formId, name);
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}

export async function saveDraftAction(
  formId: string,
  expectedRevision: number,
  schema: unknown,
  clientIdentityMapping?: { fullNameFieldKey: string; emailFieldKey: string; phoneFieldKey?: string | null } | null,
  reviewRules?: unknown,
) {
  const { workspace } = await requireWorkspace();
  try {
    const draft = await updateDraft(getPoolDb(), {
      workspaceId: workspace.id,
      formId,
      expectedRevision,
      schema,
      clientIdentityMapping,
      reviewRules: reviewRules as never,
    });
    return {
      ok: true as const,
      revision: draft.revision,
      schema: draft.schema,
      clientIdentityMapping: draft.clientIdentityMapping,
      reviewRules: draft.reviewRules,
    };
  } catch (error) {
    return asError(error);
  }
}

export async function publishFormAction(formId: string) {
  const { workspace, user } = await requireWorkspace();
  try {
    const published = await publishForm(getPoolDb(), {
      workspaceId: workspace.id,
      formId,
      userId: user.id,
    });
    return { ok: true as const, versionNumber: published.version.versionNumber };
  } catch (error) {
    return asError(error);
  }
}

export async function archiveFormAction(formId: string) {
  const { workspace } = await requireWorkspace();
  try {
    await archiveForm(getPoolDb(), workspace.id, formId);
    return { ok: true as const };
  } catch (error) {
    return asError(error);
  }
}
