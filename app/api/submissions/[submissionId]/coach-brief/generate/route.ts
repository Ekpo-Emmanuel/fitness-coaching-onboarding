import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { generateCoachBrief, getCoachBrief } from "@/lib/intelligence/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;
  let retry = false;
  try {
    const body = await request.json().catch(() => ({}));
    retry = Boolean(body && typeof body === "object" && "retry" in body && body.retry);
  } catch {
    retry = false;
  }
  try {
    const session = await requireWorkspaceApi();
    const brief = await generateCoachBrief(getPoolDb(), {
      workspaceId: session.workspace.id,
      submissionId,
      retry,
    });
    return NextResponse.json({
      status: brief.status,
      payload: brief.payload ?? null,
    });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Coach Brief couldn't be generated." }, { status: 502 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;
  try {
    const session = await requireWorkspaceApi();
    const brief = await getCoachBrief(getPoolDb(), session.workspace.id, submissionId);
    if (!brief) return NextResponse.json({ status: "pending", payload: null });
    return NextResponse.json({ status: brief.status, payload: brief.payload ?? null });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
