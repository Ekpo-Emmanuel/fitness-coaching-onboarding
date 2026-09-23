import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { deleteWorkspaceData, exportWorkspaceJson, EXTERNAL_DELETE_NOTICE } from "@/lib/privacy/service";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireWorkspaceApi();
    const payload = await exportWorkspaceJson(getPoolDb(), session.workspace.id);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="workspace-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof FormServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not export workspace." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireWorkspaceApi();
    const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm.", notice: EXTERNAL_DELETE_NOTICE }, { status: 400 });
    }
    const result = await deleteWorkspaceData(getPoolDb(), session.workspace.id, session.user.id, session.membership.role);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkspaceAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof FormServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not delete workspace." }, { status: 400 });
  }
}
