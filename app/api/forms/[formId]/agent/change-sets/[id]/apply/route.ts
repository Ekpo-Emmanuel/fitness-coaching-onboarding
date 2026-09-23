import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { applyAgentChangeSet } from "@/lib/agent/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ formId: string; id: string }> },
) {
  const { formId, id } = await context.params;
  try {
    const session = await requireWorkspaceApi();
    const result = await applyAgentChangeSet(getPoolDb(), {
      workspaceId: session.workspace.id,
      formId,
      changeSetId: id,
    });
    return NextResponse.json({
      ok: true,
      revision: result.draft.revision,
      schema: result.draft.schema,
      clientIdentityMapping: result.draft.clientIdentityMapping,
      reviewRules: result.draft.reviewRules,
      formName: result.form.name,
    });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not apply those changes." }, { status: 400 });
  }
}
