import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { rejectAgentChangeSet } from "@/lib/agent/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ formId: string; id: string }> },
) {
  const { formId, id } = await context.params;
  try {
    const session = await requireWorkspaceApi();
    await rejectAgentChangeSet(getPoolDb(), {
      workspaceId: session.workspace.id,
      formId,
      changeSetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not reject those changes." }, { status: 400 });
  }
}
