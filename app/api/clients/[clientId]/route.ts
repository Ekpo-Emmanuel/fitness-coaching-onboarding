import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { exportClientJson, deleteClientData, EXTERNAL_DELETE_NOTICE } from "@/lib/privacy/service";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";
import { log, requestIdFrom } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await context.params;
  try {
    const session = await requireWorkspaceApi();
    const payload = await exportClientJson(getPoolDb(), session.workspace.id, clientId);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="client-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof FormServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not export that client." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await context.params;
  const requestId = requestIdFrom(request);
  try {
    const session = await requireWorkspaceApi();
    const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm.", notice: EXTERNAL_DELETE_NOTICE }, { status: 400 });
    }
    const result = await deleteClientData(getPoolDb(), session.workspace.id, clientId, session.user.id);
    log.info("client_delete_api", { requestId, clientId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkspaceAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof FormServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not delete that client." }, { status: 400 });
  }
}
