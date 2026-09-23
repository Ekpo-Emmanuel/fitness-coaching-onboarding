import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { AgentProviderError } from "@/lib/ai/config";
import { proposeAgentTurn } from "@/lib/agent/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ formId: string }> }) {
  const { formId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const message =
    payload && typeof payload === "object" && !Array.isArray(payload) && "message" in payload
      ? String((payload as { message: unknown }).message ?? "")
      : "";
  try {
    const session = await requireWorkspaceApi();
    const result = await proposeAgentTurn(getPoolDb(), {
      workspaceId: session.workspace.id,
      formId,
      userId: session.user.id,
      message,
    });
    return NextResponse.json({
      ok: true,
      threadId: result.thread.id,
      message: {
        id: result.message.id,
        role: result.message.role,
        content: result.message.content,
        changeSetId: result.message.changeSetId,
        createdAt: result.message.createdAt,
      },
      changeSet: result.changeSet
        ? {
            id: result.changeSet.id,
            status: result.changeSet.status,
            summary: result.changeSet.summary,
            details: result.changeSet.details,
            baseDraftRevision: result.changeSet.baseDraftRevision,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AgentProviderError) {
      return NextResponse.json(
        { error: "The Agent couldn't complete that request. Your form has not been changed." },
        { status: error.code === "missing_key" ? 503 : 502 },
      );
    }
    return NextResponse.json(
      { error: "The Agent couldn't complete that request. Your form has not been changed." },
      { status: 502 },
    );
  }
}
