import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { getAgentChangeSet } from "@/lib/agent/service";
import { applyAgentOperations, parseAgentOperations } from "@/lib/agent/apply-operations";
import { getWorkspaceDraft } from "@/lib/forms/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";
export async function GET(_request: Request, context: { params: Promise<{ formId: string; id: string }> }) {
  try {
    const { formId, id } = await context.params;
    const { workspace } = await requireWorkspaceApi();
    const db = getPoolDb();
    const proposal = await getAgentChangeSet(db, workspace.id, formId, id);
    const draft = await getWorkspaceDraft(db, workspace.id, formId);
    if (proposal.status !== "proposed" || proposal.baseDraftRevision !== draft.revision) return NextResponse.json({ error: "Your draft changed after this proposal. Ask the Agent for an updated proposal." }, { status: 409 });
    const preview = applyAgentOperations({ schema: draft.schema, clientIdentityMapping: draft.clientIdentityMapping ?? null, reviewRules: draft.reviewRules ?? null, operations: parseAgentOperations(proposal.operations) });
    return NextResponse.json({ schema: preview.schema, reviewRules: preview.reviewRules });
  } catch (error) {
    if (error instanceof WorkspaceAuthError || error instanceof FormServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not preview these changes. Your draft is unchanged." }, { status: 400 });
  }
}
