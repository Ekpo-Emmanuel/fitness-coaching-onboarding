"use server";

import { getPoolDb } from "@/lib/db/node";
import { markSubmissionReviewed } from "@/lib/clients/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspace } from "@/lib/workspace/session";

export async function markReviewedAction(submissionId: string) {
  const { workspace } = await requireWorkspace();
  try {
    await markSubmissionReviewed(getPoolDb(), workspace.id, submissionId);
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof FormServiceError ? error.message : "Could not update the submission." };
  }
}
